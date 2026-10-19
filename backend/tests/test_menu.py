from decimal import Decimal

import pytest

from app.models import MenuItem, OrderItem, Restaurant, RestaurantTable, TableSession, UserRole

NUOVO = {"name": "Margherita", "category": "Pizze", "price": "8.50"}


@pytest.fixture
def ristorante(db):
    r = Restaurant(name="Trattoria Test")
    db.add(r)
    db.flush()
    return r


def _piatto(db, ristorante, name="Carbonara", price="12.00", available=True):
    item = MenuItem(
        restaurant_id=ristorante.id,
        name=name,
        category="Primi",
        price=Decimal(price),
        available=available,
    )
    db.add(item)
    db.flush()
    return item


def test_menu_pubblico_mostra_solo_piatti_disponibili(client, db, ristorante):
    _piatto(db, ristorante, "Carbonara")
    _piatto(db, ristorante, "Esaurito", available=False)
    r = client.get("/api/menu")
    assert r.status_code == 200
    assert [i["name"] for i in r.json()] == ["Carbonara"]


def test_menu_completo_richiede_admin(client, auth_header):
    assert client.get("/api/menu/all").status_code == 401
    assert client.get("/api/menu/all", headers=auth_header(UserRole.WAITER)).status_code == 403
    assert client.get("/api/menu/all", headers=auth_header(UserRole.ADMIN)).status_code == 200


def test_menu_completo_include_non_disponibili(client, db, ristorante, auth_header):
    _piatto(db, ristorante, "Carbonara")
    _piatto(db, ristorante, "Esaurito", available=False)
    r = client.get("/api/menu/all", headers=auth_header(UserRole.ADMIN))
    assert {i["name"] for i in r.json()} == {"Carbonara", "Esaurito"}


def test_crea_piatto_solo_admin(client, auth_header):
    assert client.post("/api/menu", json=NUOVO).status_code == 401
    r = client.post("/api/menu", json=NUOVO, headers=auth_header(UserRole.WAITER))
    assert r.status_code == 403


def test_crea_piatto(client, ristorante, auth_header):
    r = client.post("/api/menu", json=NUOVO, headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Margherita"
    assert body["price"] == "8.50"
    assert body["available"] is True
    assert client.get("/api/menu").json()[0]["id"] == body["id"]


def test_crea_piatto_senza_ristorante_ne_crea_uno(client, db, auth_header):
    r = client.post("/api/menu", json=NUOVO, headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 201
    assert db.query(Restaurant).count() == 1


@pytest.mark.parametrize(
    "campo,valore",
    [("price", "-1"), ("price", "1.999"), ("name", ""), ("category", "")],
)
def test_crea_piatto_valida_i_dati(client, auth_header, campo, valore):
    r = client.post("/api/menu", json={**NUOVO, campo: valore}, headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 422


def test_modifica_piatto(client, db, ristorante, auth_header):
    item = _piatto(db, ristorante)
    r = client.put(
        f"/api/menu/{item.id}",
        json={"name": "Carbonara", "category": "Primi", "price": "13.00", "available": False},
        headers=auth_header(UserRole.ADMIN),
    )
    assert r.status_code == 200
    assert r.json()["price"] == "13.00"
    assert r.json()["available"] is False


def test_modifica_piatto_inesistente_404(client, auth_header):
    r = client.put("/api/menu/999999", json=NUOVO, headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 404


def test_modifica_solo_admin(client, db, ristorante, auth_header):
    item = _piatto(db, ristorante)
    r = client.put(f"/api/menu/{item.id}", json=NUOVO, headers=auth_header(UserRole.WAITER))
    assert r.status_code == 403


def test_elimina_piatto_mai_ordinato(client, db, ristorante, auth_header):
    item = _piatto(db, ristorante)
    r = client.delete(f"/api/menu/{item.id}", headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 204
    assert db.get(MenuItem, item.id) is None


def test_elimina_piatto_gia_ordinato_da_409(client, db, ristorante, auth_header):
    item = _piatto(db, ristorante)
    table = RestaurantTable(restaurant_id=ristorante.id, number=1, qr_token="t")
    db.add(table)
    db.flush()
    sessione = TableSession(table_id=table.id, coperti=2)
    db.add(sessione)
    db.flush()
    db.add(
        OrderItem(session_id=sessione.id, menu_item_id=item.id, quantity=1, unit_price=item.price)
    )
    db.flush()
    r = client.delete(f"/api/menu/{item.id}", headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 409
    assert "non disponibile" in r.json()["detail"]
    assert db.get(MenuItem, item.id) is not None
