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
