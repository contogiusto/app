import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Restaurant, RestaurantTable, SessionStatus, TableSession, UserRole


@pytest.fixture
def tavolo(db):
    r = Restaurant(name="Trattoria Test")
    db.add(r)
    db.flush()
    t = RestaurantTable(restaurant_id=r.id, number=1, qr_token="tok")
    db.add(t)
    db.flush()
    return t


def test_apri_sessione_come_cameriere(client, tavolo, auth_header):
    r = client.post(
        "/api/sessions",
        json={"table_id": tavolo.id, "coperti": 4},
        headers=auth_header(UserRole.WAITER),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["table_id"] == tavolo.id
    assert body["coperti"] == 4
    assert body["status"] == "OPEN"
    assert body["payment_mode"] is None


def test_apri_sessione_richiede_staff(client, tavolo):
    r = client.post("/api/sessions", json={"table_id": tavolo.id, "coperti": 2})
    assert r.status_code == 401


def test_apri_sessione_su_tavolo_inesistente_404(client, auth_header):
    r = client.post(
        "/api/sessions",
        json={"table_id": 999999, "coperti": 2},
        headers=auth_header(UserRole.WAITER),
    )
    assert r.status_code == 404


def test_secondo_tavolo_aperto_409(client, tavolo, auth_header):
    corpo = {"table_id": tavolo.id, "coperti": 2}
    h = auth_header(UserRole.WAITER)
    assert client.post("/api/sessions", json=corpo, headers=h).status_code == 201
    r = client.post("/api/sessions", json=corpo, headers=h)
    assert r.status_code == 409
    assert "già" in r.json()["detail"]


def test_si_puo_riaprire_dopo_la_chiusura(client, db, tavolo, auth_header):
    vecchia = TableSession(table_id=tavolo.id, coperti=2, status=SessionStatus.CLOSED)
    db.add(vecchia)
    db.flush()
    r = client.post(
        "/api/sessions",
        json={"table_id": tavolo.id, "coperti": 3},
        headers=auth_header(UserRole.WAITER),
    )
    assert r.status_code == 201


@pytest.mark.parametrize("coperti", [0, -1, 101])
def test_coperti_validati(client, tavolo, auth_header, coperti):
    r = client.post(
        "/api/sessions",
        json={"table_id": tavolo.id, "coperti": coperti},
        headers=auth_header(UserRole.WAITER),
    )
    assert r.status_code == 422


def test_elenco_tavoli_mostra_la_sessione_aperta(client, tavolo, auth_header):
    h = auth_header(UserRole.WAITER)
    sessione = client.post(
        "/api/sessions", json={"table_id": tavolo.id, "coperti": 2}, headers=h
    ).json()
    tavoli = client.get("/api/tables", headers=h).json()
    assert tavoli[0]["open_session_id"] == sessione["id"]


def test_leggi_sessione(client, tavolo, auth_header):
    h = auth_header(UserRole.WAITER)
    creata = client.post(
        "/api/sessions", json={"table_id": tavolo.id, "coperti": 2}, headers=h
    ).json()
    assert client.get(f"/api/sessions/{creata['id']}").status_code == 401
    r = client.get(f"/api/sessions/{creata['id']}", headers=h)
    assert r.status_code == 200
    assert r.json()["id"] == creata["id"]
    assert client.get("/api/sessions/999999", headers=h).status_code == 404


def test_il_database_vieta_due_sessioni_aperte_sullo_stesso_tavolo(db, tavolo):
    """Garanzia a livello DB, valida anche se due richieste arrivano insieme."""
    db.add(TableSession(table_id=tavolo.id, coperti=2))
    db.flush()
    db.add(TableSession(table_id=tavolo.id, coperti=3))
    with pytest.raises(IntegrityError):
        db.flush()


def _sessione_con_pagamenti(db, tavolo, *, stati):
    """Sessione aperta con un piatto da 10,00 e un pagamento da 5,00 per ogni stato dato."""
    from app.models import MenuItem, OrderItem, Payment, PaymentMethod, PaymentMode, PaymentStatus

    piatto = MenuItem(restaurant_id=tavolo.restaurant_id, name="Pasta", category="Primi", price=10)
    db.add(piatto)
    db.flush()
    s = TableSession(table_id=tavolo.id, coperti=4, payment_mode=PaymentMode.ROMANA)
    db.add(s)
    db.flush()
    db.add(OrderItem(session_id=s.id, menu_item_id=piatto.id, quantity=1, unit_price=10))
    for stato in stati:
        method = PaymentMethod.CASH if stato == PaymentStatus.CASH else PaymentMethod.ONLINE
        db.add(
            Payment(
                session_id=s.id,
                amount=5,
                mode=PaymentMode.ROMANA,
                method=method,
                status=stato,
                customer_nickname="Anna",
            )
        )
    db.flush()
    return s


def test_sessioni_aperte_riassumono_conto_e_contanti_da_confermare(client, db, tavolo, auth_header):
    from app.models import PaymentStatus

    s = _sessione_con_pagamenti(db, tavolo, stati=[PaymentStatus.COMPLETED, PaymentStatus.CASH])
    r = client.get("/api/sessions/open", headers=auth_header(UserRole.WAITER))
    assert r.status_code == 200
    assert r.json() == [
        {
            "id": s.id,
            "table_id": tavolo.id,
            "coperti": 4,
            "payment_mode": "ROMANA",
            "total": "10.00",
            "paid_total": "10.00",
            "cash_pending": 1,
        }
    ]


def test_sessioni_aperte_senza_ordini_ne_pagamenti(client, db, tavolo, auth_header):
    s = _sessione_con_pagamenti(db, tavolo, stati=[])
    r = client.get("/api/sessions/open", headers=auth_header(UserRole.WAITER))
    assert r.json()[0]["paid_total"] == "0.00"
    assert r.json()[0]["cash_pending"] == 0
    assert r.json()[0]["id"] == s.id


def test_sessioni_aperte_escludono_le_chiuse(client, db, tavolo, auth_header):
    db.add(TableSession(table_id=tavolo.id, coperti=2, status=SessionStatus.CLOSED))
    db.flush()
    r = client.get("/api/sessions/open", headers=auth_header(UserRole.WAITER))
    assert r.json() == []


def test_sessioni_aperte_richiedono_staff(client):
    assert client.get("/api/sessions/open").status_code == 401
