from decimal import Decimal

import pytest

from app.models import (
    MenuItem,
    OrderItem,
    Payment,
    Restaurant,
    RestaurantTable,
    SessionStatus,
    TableSession,
)

TOKEN = "token-del-tavolo"
H = {"X-Table-Token": TOKEN}


@pytest.fixture
def tavolo(db):
    r = Restaurant(name="Trattoria Test")
    db.add(r)
    db.flush()
    t = RestaurantTable(restaurant_id=r.id, number=5, qr_token=TOKEN)
    db.add(t)
    db.flush()
    return t


@pytest.fixture
def sessione(db, tavolo):
    s = TableSession(table_id=tavolo.id, coperti=2)
    db.add(s)
    db.flush()
    return s


@pytest.fixture
def piatto(db, tavolo):
    m = MenuItem(
        restaurant_id=tavolo.restaurant_id, name="Pizza", category="X", price=Decimal("10.00")
    )
    db.add(m)
    db.flush()
    return m


def _ordina(db, sessione, piatto, quantita=1):
    item = OrderItem(
        session_id=sessione.id,
        menu_item_id=piatto.id,
        quantity=quantita,
        unit_price=piatto.price,
    )
    db.add(item)
    db.flush()
    return item


def _url(tavolo, suffisso=""):
    return f"/api/public/tables/{tavolo.id}{suffisso}"


# --- accesso con token ---------------------------------------------------------------------


def test_vista_tavolo_con_sessione_aperta(client, db, tavolo, sessione, piatto):
    _ordina(db, sessione, piatto, 2)
    r = client.get(_url(tavolo), headers=H)
    assert r.status_code == 200
    body = r.json()
    assert body["table_number"] == 5
    s = body["session"]
    assert s["id"] == sessione.id
    assert s["coperti"] == 2
    assert s["payment_mode"] is None
    assert s["total"] == "20.00"
    assert s["paid_total"] == "0.00"
    assert s["remaining"] == "20.00"
    assert s["items"][0]["name"] == "Pizza"
    assert s["items"][0]["paid_quantity"] == 0
    assert s["payments"] == []


def test_la_vista_non_espone_il_token(client, tavolo, sessione):
    assert TOKEN not in client.get(_url(tavolo), headers=H).text


def test_senza_sessione_aperta_la_vista_e_vuota(client, db, tavolo, sessione):
    sessione.status = SessionStatus.CLOSED
    db.flush()
    r = client.get(_url(tavolo), headers=H)
    assert r.status_code == 200
    assert r.json()["session"] is None


@pytest.mark.parametrize("header", [{"X-Table-Token": "sbagliato"}, {}, {"X-Table-Token": ""}])
def test_token_errato_o_assente_da_sempre_404(client, tavolo, sessione, header):
    r = client.get(_url(tavolo), headers=header)
    assert r.status_code == 404
    inesistente = client.get("/api/public/tables/999999", headers=header)
    # Stessa risposta di un tavolo inesistente: non si scopre quali tavoli esistono.
    assert r.json() == inesistente.json()


def test_il_token_di_un_altro_tavolo_non_vale(client, db, tavolo, sessione):
    altro = RestaurantTable(restaurant_id=tavolo.restaurant_id, number=6, qr_token="altro-token")
    db.add(altro)
    db.flush()
    r = client.get(_url(tavolo), headers={"X-Table-Token": "altro-token"})
    assert r.status_code == 404


# --- modalità -----------------------------------------------------------------------------


def test_prima_persona_sceglie_la_modalita_e_vale_per_tutti(client, tavolo, sessione):
    r = client.put(_url(tavolo, "/mode"), json={"payment_mode": "ROMANA"}, headers=H)
    assert r.status_code == 200
    assert r.json()["session"]["payment_mode"] == "ROMANA"
    r = client.put(_url(tavolo, "/mode"), json={"payment_mode": "OWN"}, headers=H)
    assert r.json()["session"]["payment_mode"] == "ROMANA"


def test_modalita_con_token_errato_404(client, tavolo, sessione):
    r = client.put(
        _url(tavolo, "/mode"),
        json={"payment_mode": "OWN"},
        headers={"X-Table-Token": "no"},
    )
    assert r.status_code == 404


def test_modalita_senza_sessione_aperta_409(client, tavolo):
    r = client.put(_url(tavolo, "/mode"), json={"payment_mode": "OWN"}, headers=H)
    assert r.status_code == 409


# --- pagamenti ----------------------------------------------------------------------------


def _paga(client, tavolo, corpo, header=H):
    return client.post(_url(tavolo, "/payments"), json=corpo, headers=header)


def test_pagamento_alla_romana_del_cliente(client, db, tavolo, sessione, piatto):
    _ordina(db, sessione, piatto, 2)
    client.put(_url(tavolo, "/mode"), json={"payment_mode": "ROMANA"}, headers=H)
    r = _paga(client, tavolo, {"method": "ONLINE", "customer_nickname": "Anna"})
    assert r.status_code == 201
    assert r.json()["amount"] == "10.00"
    vista = client.get(_url(tavolo), headers=H).json()["session"]
    assert vista["paid_total"] == "10.00"
    assert vista["remaining"] == "10.00"
    assert vista["payments"][0]["customer_nickname"] == "Anna"


def test_pagamento_proprio_conto_del_cliente(client, db, tavolo, sessione, piatto):
    item = _ordina(db, sessione, piatto, 2)
    client.put(_url(tavolo, "/mode"), json={"payment_mode": "OWN"}, headers=H)
    corpo = {
        "method": "CASH",
        "customer_nickname": "Luca",
        "items": [{"order_item_id": item.id, "quantity": 1}],
    }
    r = _paga(client, tavolo, corpo)
    assert r.status_code == 201
    assert r.json()["status"] == "CASH"
    vista = client.get(_url(tavolo), headers=H).json()["session"]
    assert vista["items"][0]["paid_quantity"] == 1


def test_pagamento_senza_modalita_409(client, db, tavolo, sessione, piatto):
    _ordina(db, sessione, piatto)
    r = _paga(client, tavolo, {"method": "ONLINE", "customer_nickname": "Anna"})
    assert r.status_code == 409


def test_pagamento_con_token_errato_non_crea_nulla(client, db, tavolo, sessione, piatto):
    _ordina(db, sessione, piatto)
    client.put(_url(tavolo, "/mode"), json={"payment_mode": "ROMANA"}, headers=H)
    r = _paga(
        client,
        tavolo,
        {"method": "ONLINE", "customer_nickname": "Intruso"},
        header={"X-Table-Token": "no"},
    )
    assert r.status_code == 404
    assert db.query(Payment).count() == 0


def test_pagamento_senza_sessione_aperta_409(client, tavolo):
    r = _paga(client, tavolo, {"method": "ONLINE", "customer_nickname": "Anna"})
    assert r.status_code == 409


def test_nome_obbligatorio_422(client, tavolo, sessione):
    assert _paga(client, tavolo, {"method": "ONLINE", "customer_nickname": ""}).status_code == 422


# --- dati per la schermata cliente ---------------------------------------------------------


def test_la_vista_include_nome_ristorante_e_categoria(client, db, tavolo, sessione, piatto):
    _ordina(db, sessione, piatto)
    corpo = client.get(_url(tavolo), headers=H).json()
    assert corpo["restaurant_name"] == "Trattoria Test"
    assert corpo["session"]["items"][0]["category"] == "X"


def test_quota_da_pagare_solo_alla_romana(client, db, tavolo, sessione, piatto):
    _ordina(db, sessione, piatto, 1)
    assert client.get(_url(tavolo), headers=H).json()["session"]["next_share"] is None
    client.put(_url(tavolo, "/mode"), json={"payment_mode": "OWN"}, headers=H)
    assert client.get(_url(tavolo), headers=H).json()["session"]["next_share"] is None


def test_quota_romana_con_il_resto_all_ultimo(client, db, tavolo, piatto):
    sessione = TableSession(table_id=tavolo.id, coperti=3)
    db.add(sessione)
    db.flush()
    _ordina(db, sessione, piatto, 1)  # 10.00 su 3 coperti
    client.put(_url(tavolo, "/mode"), json={"payment_mode": "ROMANA"}, headers=H)

    def quota():
        return client.get(_url(tavolo), headers=H).json()["session"]["next_share"]

    assert quota() == "3.33"
    _paga(client, tavolo, {"method": "ONLINE", "customer_nickname": "A"})
    assert quota() == "3.33"
    _paga(client, tavolo, {"method": "ONLINE", "customer_nickname": "B"})
    assert quota() == "3.34"  # l ultimo copre la differenza di arrotondamento


def test_quota_romana_assente_senza_ordini(client, tavolo, sessione):
    client.put(_url(tavolo, "/mode"), json={"payment_mode": "ROMANA"}, headers=H)
    assert client.get(_url(tavolo), headers=H).json()["session"]["next_share"] is None
