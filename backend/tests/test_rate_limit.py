"""Rate limit: contatori su tabella con finestra fissa (vedi app/ratelimit.py)."""

import pytest
from sqlalchemy import create_engine, text

from app import ratelimit
from app.config import settings
from app.errors import TooManyRequests
from app.models import (
    MenuItem,
    OrderItem,
    Restaurant,
    RestaurantTable,
    TableSession,
    UserRole,
)

TOKEN = "token-rate-limit"
H = {"X-Table-Token": TOKEN}


@pytest.fixture
def orologio(monkeypatch):
    """Tempo controllabile: `orologio.t` è l'ora corrente in secondi."""

    class Orologio:
        t = 1_000_000.0

    monkeypatch.setattr(ratelimit, "_adesso", lambda: Orologio.t)
    return Orologio


@pytest.fixture
def limiti(monkeypatch):
    def _imposta(**valori):
        for nome, valore in valori.items():
            monkeypatch.setattr(settings, nome, valore)

    return _imposta


@pytest.fixture
def tavolo(db):
    r = Restaurant(name="Trattoria RL")
    db.add(r)
    db.flush()
    t = RestaurantTable(restaurant_id=r.id, number=1, qr_token=TOKEN)
    db.add(t)
    db.flush()
    return t


@pytest.fixture
def tavolo_con_conto(db, tavolo):
    s = TableSession(table_id=tavolo.id, coperti=2)
    piatto = MenuItem(restaurant_id=tavolo.restaurant_id, name="Pizza", category="X", price="10.00")
    db.add_all([s, piatto])
    db.flush()
    db.add(OrderItem(session_id=s.id, menu_item_id=piatto.id, quantity=2, unit_price="10.00"))
    db.flush()
    return tavolo


# --- contatore ---------------------------------------------------------------


def test_il_contatore_scatta_oltre_il_limite(orologio):
    for _ in range(3):
        ratelimit.colpisci("k", limite=3, finestra=60)
    with pytest.raises(TooManyRequests) as exc:
        ratelimit.colpisci("k", limite=3, finestra=60)
    assert exc.value.status_code == 429
    assert 1 <= exc.value.retry_after <= 60


def test_retry_after_e_il_tempo_a_fine_finestra(orologio):
    orologio.t = 1_000_000.0 - (1_000_000 % 60) + 45  # 45 s dentro la finestra
    ratelimit.colpisci("k", limite=1, finestra=60)
    with pytest.raises(TooManyRequests) as exc:
        ratelimit.colpisci("k", limite=1, finestra=60)
    assert exc.value.retry_after == 15


def test_finestra_scaduta_si_riparte(orologio):
    ratelimit.colpisci("k", limite=1, finestra=60)
    with pytest.raises(TooManyRequests):
        ratelimit.colpisci("k", limite=1, finestra=60)
    orologio.t += 60
    ratelimit.colpisci("k", limite=1, finestra=60)  # nuova finestra: di nuovo permesso


def test_chiavi_indipendenti(orologio):
    ratelimit.colpisci("a", limite=1, finestra=60)
    ratelimit.colpisci("b", limite=1, finestra=60)
    with pytest.raises(TooManyRequests):
        ratelimit.colpisci("a", limite=1, finestra=60)


def test_verifica_non_consuma_il_limite(orologio):
    for _ in range(5):
        ratelimit.verifica("k", limite=2, finestra=60)
    ratelimit.colpisci("k", limite=2, finestra=60)
    ratelimit.verifica("k", limite=2, finestra=60)
    ratelimit.colpisci("k", limite=2, finestra=60)
    with pytest.raises(TooManyRequests):
        ratelimit.verifica("k", limite=2, finestra=60)


def test_pulizia_elimina_solo_le_righe_scadute(orologio, engine):
    ratelimit.colpisci("vecchia", limite=5, finestra=60)
    orologio.t += 120
    ratelimit.colpisci("nuova", limite=5, finestra=60)
    ratelimit.pulisci()
    with engine.connect() as conn:
        chiavi = set(conn.execute(text("SELECT key FROM rate_limit_counter")).scalars())
    assert chiavi == {"nuova"}


def test_la_pulizia_scatta_in_modo_opportunistico(orologio, engine, monkeypatch):
    ratelimit.colpisci("vecchia", limite=5, finestra=60)
    orologio.t += 120
    monkeypatch.setattr(ratelimit, "PROBABILITA_PULIZIA", 1.0)
    ratelimit.colpisci("nuova", limite=5, finestra=60)
    with engine.connect() as conn:
        chiavi = set(conn.execute(text("SELECT key FROM rate_limit_counter")).scalars())
    assert chiavi == {"nuova"}


def test_se_il_contatore_non_funziona_la_richiesta_passa(orologio, monkeypatch, caplog):
    """Es. codice nuovo deployato prima della migration: meglio non bloccare i pagamenti."""
    rotto = create_engine(settings.database_url.rsplit("/", 1)[0] + "/db_inesistente")
    monkeypatch.setattr(ratelimit.database, "engine", rotto)
    ratelimit.colpisci("k", limite=1, finestra=60)
    ratelimit.colpisci("k", limite=1, finestra=60)
    ratelimit.verifica("k", limite=1, finestra=60)
    assert "rate limit non disponibile" in caplog.text


@pytest.mark.parametrize(
    "header,atteso",
    [
        ({"x-real-ip": "203.0.113.7"}, "203.0.113.7"),
        # XFF: vale l'ultimo valore (quello aggiunto dal proxy fidato), non il primo (del client).
        ({"x-forwarded-for": "1.2.3.4, 203.0.113.9"}, "203.0.113.9"),
        # Un IPv6 vale per tutta la sua /64: cambiare ultimi bit non aggira il limite.
        ({"x-real-ip": "2001:db8:1:2:aaaa:bbbb:cccc:dddd"}, "2001:db8:1:2::/64"),
    ],
)
def test_ip_dal_proxy_fidato(limiti, header, atteso):
    limiti(trust_proxy_headers=True)
    assert ratelimit.ip_client(header, "10.0.0.1") == atteso


def test_ip_header_ignorati_se_non_fidati(limiti):
    limiti(trust_proxy_headers=False)
    ip = ratelimit.ip_client({"x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.6"}, "10.0.0.1")
    assert ip == "10.0.0.1"


# --- endpoint pubblici -------------------------------------------------------


def test_token_errato_oltre_il_limite_429(client, tavolo, orologio, limiti):
    limiti(rate_limit_public_fail_max=3)
    for _ in range(3):
        r = client.get(f"/api/public/tables/{tavolo.id}", headers={"X-Table-Token": "no"})
        assert r.status_code == 404
    r = client.get(f"/api/public/tables/{tavolo.id}", headers={"X-Table-Token": "no"})
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) >= 1
    assert r.json()["detail"] == "Troppe richieste: riprova tra qualche istante"
    # Bloccato l'IP: anche il token giusto aspetta (non si può verificare un token a oltranza).
    assert client.get(f"/api/public/tables/{tavolo.id}", headers=H).status_code == 429


def test_token_errato_finestra_scaduta_riparte(client, tavolo, orologio, limiti):
    limiti(rate_limit_public_fail_max=1, rate_limit_public_fail_window=600)
    client.get(f"/api/public/tables/{tavolo.id}", headers={"X-Table-Token": "no"})
    assert (
        client.get(f"/api/public/tables/{tavolo.id}", headers={"X-Table-Token": "no"}).status_code
        == 429
    )
    orologio.t += 600
    assert client.get(f"/api/public/tables/{tavolo.id}", headers=H).status_code == 200


def test_i_fallimenti_sono_per_ip(client, tavolo, orologio, limiti):
    limiti(rate_limit_public_fail_max=1, trust_proxy_headers=True)
    url = f"/api/public/tables/{tavolo.id}"
    sbagliato = {"X-Table-Token": "no"}
    assert client.get(url, headers={**sbagliato, "x-real-ip": "198.51.100.1"}).status_code == 404
    assert client.get(url, headers={**sbagliato, "x-real-ip": "198.51.100.1"}).status_code == 429
    # un altro IP non è toccato
    assert client.get(url, headers={**sbagliato, "x-real-ip": "198.51.100.2"}).status_code == 404


def test_i_token_giusti_non_contano_come_fallimenti(client, tavolo, orologio, limiti):
    limiti(rate_limit_public_fail_max=1)
    for _ in range(10):
        assert client.get(f"/api/public/tables/{tavolo.id}", headers=H).status_code == 200


def test_limite_richieste_per_tavolo(client, db, tavolo, orologio, limiti):
    limiti(rate_limit_public_table_max=3)
    altro = RestaurantTable(restaurant_id=tavolo.restaurant_id, number=2, qr_token="altro")
    db.add(altro)
    db.flush()
    for _ in range(3):
        assert client.get(f"/api/public/tables/{tavolo.id}", headers=H).status_code == 200
    r = client.get(f"/api/public/tables/{tavolo.id}", headers=H)
    assert r.status_code == 429
    assert "Retry-After" in r.headers
    # un altro tavolo ha il suo contatore
    r = client.get(f"/api/public/tables/{altro.id}", headers={"X-Table-Token": "altro"})
    assert r.status_code == 200
    orologio.t += 60
    assert client.get(f"/api/public/tables/{tavolo.id}", headers=H).status_code == 200


def test_traffico_normale_di_un_tavolo_da_otto_non_scatta(client, tavolo, orologio):
    """8 persone, polling ogni 3 s: 160 richieste/min con i limiti predefiniti."""
    url = f"/api/public/tables/{tavolo.id}"
    for secondo in range(0, 60, 3):
        orologio.t = 1_000_020.0 + secondo
        for _persona in range(8):
            assert client.get(url, headers=H).status_code == 200


def test_pagamenti_oltre_il_limite_429(client, tavolo_con_conto, orologio, limiti):
    limiti(rate_limit_public_write_max=2)
    url = f"/api/public/tables/{tavolo_con_conto.id}/payments"
    corpo = {"method": "ONLINE", "customer_nickname": "A"}
    assert (
        client.put(
            f"/api/public/tables/{tavolo_con_conto.id}/mode",
            json={"payment_mode": "ROMANA"},
            headers=H,
        ).status_code
        == 200
    )
    assert client.post(url, json=corpo, headers=H).status_code == 201
    r = client.post(url, json=corpo, headers=H)
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_la_lettura_non_consuma_il_limite_di_scrittura(client, tavolo_con_conto, orologio, limiti):
    limiti(rate_limit_public_write_max=1)
    for _ in range(5):
        assert client.get(f"/api/public/tables/{tavolo_con_conto.id}", headers=H).status_code == 200


# --- login -------------------------------------------------------------------


def _login(client, username, password="sbagliata", ip=None):
    headers = {"x-real-ip": ip} if ip else {}
    return client.post(
        "/api/auth/login", json={"username": username, "password": password}, headers=headers
    )


def test_login_sbagliato_per_username_oltre_il_limite_429(client, make_user, orologio, limiti):
    limiti(rate_limit_login_user_max=3, rate_limit_login_ip_max=100)
    make_user("mario", UserRole.WAITER, "segreta")
    for _ in range(3):
        assert _login(client, "mario").status_code == 401
    r = _login(client, "mario")
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) >= 1
    # anche la password giusta aspetta: altrimenti il limite non fermerebbe chi indovina
    assert _login(client, "mario", "segreta").status_code == 429


def test_login_username_inesistente_limitato_come_gli_altri(client, orologio, limiti):
    limiti(rate_limit_login_user_max=1, rate_limit_login_ip_max=100)
    assert _login(client, "nessuno").status_code == 401
    assert _login(client, "nessuno").status_code == 429


def test_login_username_maiuscole_stesso_contatore(client, orologio, limiti):
    limiti(rate_limit_login_user_max=1, rate_limit_login_ip_max=100)
    assert _login(client, "Mario").status_code == 401
    assert _login(client, "mario ").status_code == 429


def test_login_per_ip_oltre_il_limite_429(client, orologio, limiti):
    limiti(rate_limit_login_ip_max=2, rate_limit_login_user_max=100, trust_proxy_headers=True)
    assert _login(client, "a", ip="198.51.100.1").status_code == 401
    assert _login(client, "b", ip="198.51.100.1").status_code == 401
    assert _login(client, "c", ip="198.51.100.1").status_code == 429
    # altro IP, altro contatore
    assert _login(client, "c", ip="198.51.100.2").status_code == 401


def test_username_diversi_dallo_stesso_ip_non_si_bloccano_a_vicenda(
    client, make_user, orologio, limiti
):
    limiti(rate_limit_login_user_max=1, rate_limit_login_ip_max=100)
    make_user("mario", UserRole.WAITER, "segreta")
    make_user("luigi", UserRole.WAITER, "segreta")
    assert _login(client, "mario").status_code == 401
    assert _login(client, "mario").status_code == 429
    assert _login(client, "luigi", "segreta").status_code == 200


def test_login_corretti_non_contano(client, make_user, orologio, limiti):
    limiti(rate_limit_login_user_max=2, rate_limit_login_ip_max=2)
    make_user("mario", UserRole.WAITER, "segreta")
    for _ in range(10):
        assert _login(client, "mario", "segreta").status_code == 200


def test_login_finestra_scaduta_riparte(client, make_user, orologio, limiti):
    limiti(rate_limit_login_user_max=1, rate_limit_login_ip_max=100, rate_limit_login_window=900)
    make_user("mario", UserRole.WAITER, "segreta")
    assert _login(client, "mario").status_code == 401
    assert _login(client, "mario", "segreta").status_code == 429
    orologio.t += 900
    assert _login(client, "mario", "segreta").status_code == 200


def test_endpoint_staff_non_sono_limitati(client, auth_header, limiti):
    limiti(rate_limit_login_ip_max=1, rate_limit_login_user_max=1)
    h = auth_header(UserRole.ADMIN)
    for _ in range(10):
        assert client.get("/api/auth/me", headers=h).status_code == 200


def test_limiti_disattivabili(client, tavolo, orologio, limiti):
    limiti(rate_limit_enabled=False, rate_limit_public_fail_max=1)
    for _ in range(5):
        r = client.get(f"/api/public/tables/{tavolo.id}", headers={"X-Table-Token": "no"})
        assert r.status_code == 404
