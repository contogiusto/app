"""Account cliente: password dimenticata (link via email), cambio password, ristoranti visitati."""

import re
import time
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import func, select

from app import email as email_module
from app.config import settings
from app.models import (
    PasswordResetToken,
    Payment,
    PaymentMethod,
    PaymentMode,
    PaymentStatus,
    Restaurant,
    RestaurantTable,
    TableSession,
)
from app.security import create_customer_token, verify_password

PW = "una-password-buona"
NUOVA = "una-password-nuova-9"


@pytest.fixture
def posta(monkeypatch):
    """Le email 'spedite' (nessun invio vero)."""
    inviate: list[dict] = []

    def finta(to: str, subject: str, text: str) -> None:
        inviate.append({"to": to, "subject": subject, "text": text})

    monkeypatch.setattr("app.routers.customer.send_email", finta)
    return inviate


def _token_dalla_posta(posta) -> str:
    m = re.search(r"/reset-password#token=([A-Za-z0-9_-]+)", posta[-1]["text"])
    assert m, posta[-1]["text"]
    return m.group(1)


def _chiedi(client, email):
    return client.post("/api/customer/auth/password-reset/request", json={"email": email})


# ---------- richiesta del link ----------


def test_richiesta_con_email_registrata_invia_il_link(client, make_customer, posta):
    make_customer("anna@example.com")
    r = _chiedi(client, "Anna@Example.com ")
    assert r.status_code == 202
    assert len(posta) == 1 and posta[0]["to"] == "anna@example.com"
    assert f"{settings.frontend_url}/reset-password#token=" in posta[0]["text"]
    assert "1 ora" in posta[0]["text"]


def test_risposta_identica_per_email_registrata_o_no(client, make_customer, posta):
    make_customer("anna@example.com")
    nota = _chiedi(client, "anna@example.com")
    ignota = _chiedi(client, "nessuno@example.com")
    assert nota.status_code == ignota.status_code == 202
    assert nota.json() == ignota.json()
    assert len(posta) == 1  # solo la registrata riceve l'email


def test_il_token_in_chiaro_non_e_nel_db(client, db, make_customer, posta):
    make_customer("anna@example.com")
    _chiedi(client, "anna@example.com")
    token = _token_dalla_posta(posta)
    salvato = db.scalars(select(PasswordResetToken)).one()
    assert token not in salvato.token_hash and len(salvato.token_hash) == 64


def test_la_richiesta_e_limitata_per_email(client, make_customer, posta):
    make_customer("anna@example.com")
    for _ in range(settings.rate_limit_reset_email_max):
        assert _chiedi(client, "anna@example.com").status_code == 202
    r = _chiedi(client, "anna@example.com")
    assert r.status_code == 429 and "Retry-After" in r.headers
    # Vale anche per email inesistenti (nessuna differenza osservabile).
    for _ in range(settings.rate_limit_reset_email_max):
        _chiedi(client, "nessuno@example.com")
    assert _chiedi(client, "nessuno@example.com").status_code == 429


def test_la_richiesta_e_limitata_per_ip(client, posta):
    for i in range(settings.rate_limit_reset_ip_max):
        assert _chiedi(client, f"utente{i}@example.com").status_code == 202
    assert _chiedi(client, "altro@example.com").status_code == 429


def test_i_link_scaduti_da_tempo_si_cancellano(client, db, make_customer, posta):
    c = make_customer("anna@example.com")
    vecchio = PasswordResetToken(
        customer_id=c.id,
        token_hash="a" * 64,
        expires_at=datetime.now(UTC) - timedelta(days=2),
    )
    recente = PasswordResetToken(
        customer_id=c.id,
        token_hash="b" * 64,
        expires_at=datetime.now(UTC) - timedelta(minutes=5),
    )
    db.add_all([vecchio, recente])
    db.flush()
    _chiedi(client, "nessuno@example.com")
    hashes = set(db.scalars(select(PasswordResetToken.token_hash)))
    assert hashes == {"b" * 64}


def test_email_malformata_422(client):
    assert _chiedi(client, "non-una-email").status_code == 422


# ---------- conferma ----------


def _conferma(client, token, password=NUOVA):
    return client.post(
        "/api/customer/auth/password-reset/confirm", json={"token": token, "password": password}
    )


def test_reset_completo(client, db, make_customer, posta):
    c = make_customer("anna@example.com", PW)
    _chiedi(client, "anna@example.com")
    token = _token_dalla_posta(posta)
    assert _conferma(client, token).status_code == 204
    db.refresh(c)
    assert verify_password(NUOVA, c.password_hash)
    login = client.post(
        "/api/customer/auth/login", json={"email": "anna@example.com", "password": NUOVA}
    )
    assert login.status_code == 200
    vecchia = client.post(
        "/api/customer/auth/login", json={"email": "anna@example.com", "password": PW}
    )
    assert vecchia.status_code == 401


def test_il_link_vale_una_volta_sola(client, make_customer, posta):
    make_customer("anna@example.com")
    _chiedi(client, "anna@example.com")
    token = _token_dalla_posta(posta)
    assert _conferma(client, token).status_code == 204
    assert _conferma(client, token, "ancora-un-altra-pw-1").status_code == 400


def test_link_scaduto_o_inesistente(client, db, make_customer, posta):
    make_customer("anna@example.com")
    _chiedi(client, "anna@example.com")
    token = _token_dalla_posta(posta)
    salvato = db.scalars(select(PasswordResetToken)).one()
    salvato.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.flush()
    scaduto = _conferma(client, token)
    sconosciuto = _conferma(client, "x" * 43)
    assert scaduto.status_code == sconosciuto.status_code == 400
    assert scaduto.json() == sconosciuto.json()  # stesso messaggio: niente indizi


def test_password_nuova_valida(client, make_customer, posta):
    make_customer("anna@example.com")
    _chiedi(client, "anna@example.com")
    token = _token_dalla_posta(posta)
    assert _conferma(client, token, "corta").status_code == 422
    assert _conferma(client, token, "x" * 129).status_code == 422
    # Un tentativo con password non valida non consuma il link.
    assert _conferma(client, token).status_code == 204


def test_un_reset_chiude_gli_altri_link_dello_stesso_cliente(client, make_customer, posta):
    make_customer("anna@example.com")
    _chiedi(client, "anna@example.com")
    primo = _token_dalla_posta(posta)
    _chiedi(client, "anna@example.com")
    secondo = _token_dalla_posta(posta)
    assert primo != secondo
    assert _conferma(client, secondo).status_code == 204
    assert _conferma(client, primo).status_code == 400


def test_dopo_il_reset_i_token_di_accesso_vecchi_non_valgono(client, make_customer, posta):
    c = make_customer("anna@example.com")
    vecchio = {"Authorization": f"Bearer {create_customer_token(c)}"}
    assert client.get("/api/customer/me", headers=vecchio).status_code == 200
    time.sleep(1.1)  # i token portano l'istante in secondi
    _chiedi(client, "anna@example.com")
    _conferma(client, _token_dalla_posta(posta))
    assert client.get("/api/customer/me", headers=vecchio).status_code == 401


def test_i_token_di_reset_spariscono_con_l_account(client, db, make_customer, posta):
    c = make_customer("anna@example.com", PW)
    _chiedi(client, "anna@example.com")
    header = {"Authorization": f"Bearer {create_customer_token(c)}"}
    r = client.request("DELETE", "/api/customer/me", json={"password": PW}, headers=header)
    assert r.status_code == 204
    assert db.scalar(select(func.count()).select_from(PasswordResetToken)) == 0


# ---------- cambio password dal profilo ----------


def test_cambio_password_dal_profilo(client, make_customer):
    c = make_customer("anna@example.com", PW)
    vecchio = {"Authorization": f"Bearer {create_customer_token(c)}"}
    time.sleep(1.1)
    r = client.post(
        "/api/customer/me/password",
        json={"current_password": PW, "new_password": NUOVA},
        headers=vecchio,
    )
    assert r.status_code == 200
    nuovo = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/customer/me", headers=nuovo).status_code == 200
    assert client.get("/api/customer/me", headers=vecchio).status_code == 401
    login = client.post(
        "/api/customer/auth/login", json={"email": "anna@example.com", "password": NUOVA}
    )
    assert login.status_code == 200


def test_cambio_password_rifiutato(client, make_customer):
    c = make_customer("anna@example.com", PW)
    h = {"Authorization": f"Bearer {create_customer_token(c)}"}
    url = "/api/customer/me/password"
    assert (
        client.post(
            url, json={"current_password": "sbagliata-sbagliata", "new_password": NUOVA}, headers=h
        ).status_code
        == 403
    )
    assert (
        client.post(url, json={"current_password": PW, "new_password": PW}, headers=h).status_code
        == 422
    )
    assert (
        client.post(
            url, json={"current_password": PW, "new_password": "corta"}, headers=h
        ).status_code
        == 422
    )
    assert client.post(url, json={"current_password": PW, "new_password": NUOVA}).status_code == 401


# ---------- ristoranti visitati ----------


def _pagamento(
    db,
    cliente,
    ristorante,
    *,
    stato=PaymentStatus.COMPLETED,
    importo="10.00",
    sessione=None,
    quando=None,
):
    if sessione is None:
        numero = db.scalar(select(func.count()).select_from(RestaurantTable)) + 1
        tavolo = RestaurantTable(
            restaurant_id=ristorante.id, number=numero, qr_token=f"tk-{ristorante.id}-{numero}"
        )
        db.add(tavolo)
        db.flush()
        sessione = TableSession(table_id=tavolo.id, coperti=2)
        db.add(sessione)
        db.flush()
    p = Payment(
        session_id=sessione.id,
        amount=Decimal(importo),
        mode=PaymentMode.ROMANA,
        method=PaymentMethod.ONLINE,
        status=stato,
        customer_nickname="Anna Russo",
        customer_id=cliente.id if cliente else None,
    )
    if quando is not None:
        p.created_at = quando
    db.add(p)
    db.flush()
    return sessione


@pytest.fixture
def due_locali(db):
    a = Restaurant(name="Da Gino", slug="da-gino")
    b = Restaurant(name="Da Lia", slug="da-lia")
    db.add_all([a, b])
    db.flush()
    return a, b


def test_elenco_ristoranti_dove_ha_pagato(client, db, customer_header, make_customer, due_locali):
    header, anna = customer_header()
    gino, lia = due_locali
    ora = datetime.now(UTC)
    s1 = _pagamento(db, anna, gino, importo="10.00", quando=ora - timedelta(days=5))
    _pagamento(
        db, anna, gino, importo="5.50", sessione=s1, quando=ora - timedelta(days=5)
    )  # stessa visita
    _pagamento(db, anna, gino, importo="20.00", quando=ora - timedelta(days=2))
    _pagamento(
        db, anna, lia, importo="7.00", quando=ora - timedelta(days=1), stato=PaymentStatus.CASH
    )
    _pagamento(db, anna, lia, importo="99.00", stato=PaymentStatus.PENDING)  # non contato
    altra = make_customer("bruno@example.com")
    _pagamento(db, altra, gino, importo="1000.00")  # di un altro cliente
    _pagamento(db, None, gino, importo="2000.00")  # di un ospite
    r = client.get("/api/customer/restaurants", headers=header)
    assert r.status_code == 200
    righe = r.json()
    assert [x["slug"] for x in righe] == ["da-lia", "da-gino"]  # l'ultima visita per prima
    lia_row, gino_row = righe
    assert (lia_row["name"], lia_row["visits"], lia_row["total_paid"]) == ("Da Lia", 1, "7.00")
    assert (gino_row["visits"], gino_row["total_paid"]) == (2, "35.50")
    assert "last_visit" in gino_row


def test_elenco_vuoto_e_protetto(client, customer_header):
    assert client.get("/api/customer/restaurants").status_code == 401
    header, _ = customer_header()
    assert client.get("/api/customer/restaurants", headers=header).json() == []


def test_storico_filtrato_per_ristorante(client, db, customer_header, due_locali):
    header, anna = customer_header()
    gino, lia = due_locali
    _pagamento(db, anna, gino, importo="10.00")
    _pagamento(db, anna, lia, importo="7.00")
    tutti = client.get("/api/customer/payments", headers=header).json()
    assert len(tutti) == 2 and {p["restaurant_slug"] for p in tutti} == {"da-gino", "da-lia"}
    solo = client.get("/api/customer/payments?restaurant=da-lia", headers=header).json()
    assert [p["restaurant_name"] for p in solo] == ["Da Lia"]
    assert client.get("/api/customer/payments?restaurant=non-esiste", headers=header).json() == []


# ---------- invio email ----------


def test_senza_chiave_il_link_va_nel_log_e_non_parte_nulla(caplog, monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "email_from", "")
    called = []
    monkeypatch.setattr(email_module.httpx, "post", lambda *a, **k: called.append(1))
    with caplog.at_level("INFO"):
        email_module.send_email("anna@example.com", "Oggetto", "Testo con link")
    assert not called
    assert "Testo con link" in caplog.text


def test_con_la_chiave_chiama_resend(monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "re_test_chiave")
    monkeypatch.setattr(settings, "email_from", "Conto Giusto <noreply@example.com>")
    visto = {}

    def finto(url, json, headers, timeout):
        visto.update(url=url, json=json, headers=headers, timeout=timeout)
        return httpx.Response(200, json={"id": "abc"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(email_module.httpx, "post", finto)
    email_module.send_email("anna@example.com", "Oggetto", "Testo")
    assert visto["url"] == "https://api.resend.com/emails"
    assert visto["headers"]["Authorization"] == "Bearer re_test_chiave"
    assert visto["json"] == {
        "from": "Conto Giusto <noreply@example.com>",
        "to": ["anna@example.com"],
        "subject": "Oggetto",
        "text": "Testo",
    }
    assert visto["timeout"] <= 15


def test_un_errore_di_resend_non_fa_cadere_la_richiesta(caplog, monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "re_test_chiave")
    monkeypatch.setattr(settings, "email_from", "noreply@example.com")

    def rotto(url, json, headers, timeout):
        raise httpx.ConnectError("rete assente")

    monkeypatch.setattr(email_module.httpx, "post", rotto)
    email_module.send_email("anna@example.com", "Oggetto", "Testo")  # non solleva
    assert "invio email non riuscito" in caplog.text.lower()
    assert "re_test_chiave" not in caplog.text  # la chiave non finisce nei log
