from decimal import Decimal

import pytest

from app.models import (
    MenuItem,
    OrderItem,
    Payment,
    PaymentItem,
    PaymentMethod,
    PaymentMode,
    PaymentStatus,
    Restaurant,
    RestaurantTable,
    SessionStatus,
    TableSession,
    UserRole,
)


@pytest.fixture
def ristorante(db):
    r = Restaurant(name="Trattoria Test")
    db.add(r)
    db.flush()
    return r


@pytest.fixture
def sessione(db, ristorante):
    t = RestaurantTable(restaurant_id=ristorante.id, number=1, qr_token="tok")
    db.add(t)
    db.flush()
    s = TableSession(table_id=t.id, coperti=4)
    db.add(s)
    db.flush()
    return s


def _piatto(db, ristorante, name="Margherita", price="8.50", available=True):
    m = MenuItem(
        restaurant_id=ristorante.id,
        name=name,
        category="Pizze",
        price=Decimal(price),
        available=available,
    )
    db.add(m)
    db.flush()
    return m


@pytest.fixture
def margherita(db, ristorante):
    return _piatto(db, ristorante)


def _ordina(client, sessione, piatto, quantita=1, ruolo=UserRole.WAITER, header=None):
    return client.post(
        f"/api/sessions/{sessione.id}/orders",
        json={"menu_item_id": piatto.id, "quantity": quantita},
        headers=header,
    )


def test_aggiungi_piatto_congela_il_prezzo(client, sessione, margherita, auth_header):
    r = _ordina(client, sessione, margherita, 2, header=auth_header(UserRole.WAITER))
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Margherita"
    assert body["quantity"] == 2
    assert body["unit_price"] == "8.50"
    assert body["line_total"] == "17.00"


def test_ordine_richiede_staff(client, sessione, margherita):
    assert _ordina(client, sessione, margherita).status_code == 401


def test_ordine_registra_chi_lo_ha_aggiunto(client, db, sessione, margherita, auth_header):
    _ordina(client, sessione, margherita, header=auth_header(UserRole.WAITER))
    item = db.query(OrderItem).one()
    assert item.added_by is not None


def test_cambio_prezzo_non_altera_gli_ordini_esistenti(
    client, db, sessione, margherita, auth_header
):
    h = auth_header(UserRole.WAITER)
    _ordina(client, sessione, margherita, header=h)
    margherita.price = Decimal("9.90")
    db.flush()
    _ordina(client, sessione, margherita, header=h)
    items = client.get(f"/api/sessions/{sessione.id}/orders", headers=h).json()["items"]
    assert [i["unit_price"] for i in items] == ["8.50", "9.90"]


def test_elenco_ordini_con_totale(client, db, ristorante, sessione, margherita, auth_header):
    h = auth_header(UserRole.WAITER)
    carbonara = _piatto(db, ristorante, "Carbonara", "12.00")
    _ordina(client, sessione, margherita, 2, header=h)
    _ordina(client, sessione, carbonara, 1, header=h)
    body = client.get(f"/api/sessions/{sessione.id}/orders", headers=h).json()
    assert [i["name"] for i in body["items"]] == ["Margherita", "Carbonara"]
    assert body["total"] == "29.00"


def test_totale_nella_sessione(client, sessione, margherita, auth_header):
    h = auth_header(UserRole.WAITER)
    assert client.get(f"/api/sessions/{sessione.id}", headers=h).json()["total"] == "0.00"
    _ordina(client, sessione, margherita, 3, header=h)
    assert client.get(f"/api/sessions/{sessione.id}", headers=h).json()["total"] == "25.50"


def test_elenco_ordini_richiede_staff(client, sessione):
    assert client.get(f"/api/sessions/{sessione.id}/orders").status_code == 401


def test_sessione_o_piatto_inesistenti_404(client, sessione, margherita, auth_header):
    h = auth_header(UserRole.WAITER)
    r = client.post(
        "/api/sessions/999999/orders", json={"menu_item_id": 1, "quantity": 1}, headers=h
    )
    assert r.status_code == 404
    r = client.post(
        f"/api/sessions/{sessione.id}/orders",
        json={"menu_item_id": 999999, "quantity": 1},
        headers=h,
    )
    assert r.status_code == 404


def test_piatto_non_disponibile_409(client, db, ristorante, sessione, auth_header):
    esaurito = _piatto(db, ristorante, "Esaurito", available=False)
    r = _ordina(client, sessione, esaurito, header=auth_header(UserRole.WAITER))
    assert r.status_code == 409
    assert "non disponibile" in r.json()["detail"]


def test_sessione_chiusa_non_accetta_ordini(client, db, sessione, margherita, auth_header):
    sessione.status = SessionStatus.CLOSED
    db.flush()
    r = _ordina(client, sessione, margherita, header=auth_header(UserRole.WAITER))
    assert r.status_code == 409
    assert "chiusa" in r.json()["detail"]


@pytest.mark.parametrize("quantita", [0, -1, 100])
def test_quantita_validata(client, sessione, margherita, auth_header, quantita):
    r = _ordina(client, sessione, margherita, quantita, header=auth_header(UserRole.WAITER))
    assert r.status_code == 422


def test_rimuovi_piatto_aggiorna_il_totale(client, sessione, margherita, auth_header):
    h = auth_header(UserRole.WAITER)
    item = _ordina(client, sessione, margherita, 2, header=h).json()
    r = client.delete(f"/api/sessions/{sessione.id}/orders/{item['id']}", headers=h)
    assert r.status_code == 204
    body = client.get(f"/api/sessions/{sessione.id}/orders", headers=h).json()
    assert body["items"] == []
    assert body["total"] == "0.00"


def test_rimozione_richiede_staff(client, sessione, margherita, auth_header):
    item = _ordina(client, sessione, margherita, header=auth_header(UserRole.WAITER)).json()
    assert client.delete(f"/api/sessions/{sessione.id}/orders/{item['id']}").status_code == 401


def test_rimuovi_ordine_di_un_altra_sessione_404(
    client, db, ristorante, sessione, margherita, auth_header
):
    h = auth_header(UserRole.WAITER)
    altro_tavolo = RestaurantTable(restaurant_id=ristorante.id, number=2, qr_token="tok2")
    db.add(altro_tavolo)
    db.flush()
    altra = TableSession(table_id=altro_tavolo.id, coperti=2)
    db.add(altra)
    db.flush()
    item = _ordina(client, altra, margherita, header=h).json()
    r = client.delete(f"/api/sessions/{sessione.id}/orders/{item['id']}", headers=h)
    assert r.status_code == 404


def test_con_pagamenti_gli_ordini_sono_bloccati(client, db, sessione, margherita, auth_header):
    h = auth_header(UserRole.WAITER)
    item = _ordina(client, sessione, margherita, header=h).json()
    db.add(
        Payment(
            session_id=sessione.id,
            amount=Decimal("2.00"),
            mode=PaymentMode.ROMANA,
            method=PaymentMethod.CASH,
            status=PaymentStatus.CASH,
            customer_nickname="Mario",
        )
    )
    db.flush()
    assert _ordina(client, sessione, margherita, header=h).status_code == 409
    r = client.delete(f"/api/sessions/{sessione.id}/orders/{item['id']}", headers=h)
    assert r.status_code == 409
    assert "pagamenti" in r.json()["detail"]


def test_voce_gia_pagata_non_si_rimuove(client, db, sessione, margherita, auth_header):
    h = auth_header(UserRole.WAITER)
    item = _ordina(client, sessione, margherita, header=h).json()
    pagamento = Payment(
        session_id=sessione.id,
        amount=Decimal("8.50"),
        mode=PaymentMode.OWN,
        method=PaymentMethod.ONLINE,
        status=PaymentStatus.COMPLETED,
        customer_nickname="Mario",
    )
    db.add(pagamento)
    db.flush()
    db.add(PaymentItem(payment_id=pagamento.id, order_item_id=item["id"], quantity=1))
    db.flush()
    r = client.delete(f"/api/sessions/{sessione.id}/orders/{item['id']}", headers=h)
    assert r.status_code == 409
