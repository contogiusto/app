import pytest

from app.config import settings
from app.models import Restaurant, RestaurantTable, UserRole
from app.routers.tables import qr_url


@pytest.fixture
def ristorante(db):
    r = Restaurant(name="Trattoria Test")
    db.add(r)
    db.flush()
    return r


@pytest.fixture
def tavolo(db, ristorante):
    t = RestaurantTable(restaurant_id=ristorante.id, number=1, qr_token="token-iniziale")
    db.add(t)
    db.flush()
    return t


def test_elenco_tavoli_per_staff(client, tavolo, auth_header):
    assert client.get("/api/tables").status_code == 401
    r = client.get("/api/tables", headers=auth_header(UserRole.WAITER))
    assert r.status_code == 200
    assert r.json() == [{"id": tavolo.id, "number": 1, "open_session_id": None}]


def test_elenco_non_espone_il_token_qr(client, tavolo, auth_header):
    r = client.get("/api/tables", headers=auth_header(UserRole.ADMIN))
    assert "qr_token" not in r.json()[0]


def test_crea_tavolo_solo_admin(client, auth_header):
    assert client.post("/api/tables", json={"number": 1}).status_code == 401
    r = client.post("/api/tables", json={"number": 1}, headers=auth_header(UserRole.WAITER))
    assert r.status_code == 403


def test_crea_tavolo_genera_token_e_ristorante(client, db, auth_header):
    r = client.post("/api/tables", json={"number": 7}, headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 201
    assert r.json()["number"] == 7
    assert db.query(Restaurant).count() == 1
    assert len(db.query(RestaurantTable).one().qr_token) >= 20


def test_crea_tavolo_numero_duplicato_409(client, tavolo, auth_header):
    r = client.post("/api/tables", json={"number": 1}, headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 409


@pytest.mark.parametrize("numero", [0, -3, 10000])
def test_crea_tavolo_valida_numero(client, auth_header, numero):
    r = client.post("/api/tables", json={"number": numero}, headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 422


def test_rigenera_qr_cambia_il_token(client, db, tavolo, auth_header):
    r = client.post(f"/api/tables/{tavolo.id}/qr/regenerate", headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 204
    db.refresh(tavolo)
    assert tavolo.qr_token != "token-iniziale"


def test_rigenera_qr_solo_admin_e_404(client, tavolo, auth_header):
    url = f"/api/tables/{tavolo.id}/qr/regenerate"
    assert client.post(url, headers=auth_header(UserRole.WAITER)).status_code == 403
    r = client.post("/api/tables/999999/qr/regenerate", headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 404


def test_qr_svg_per_admin(client, tavolo, auth_header):
    r = client.get(f"/api/tables/{tavolo.id}/qr.svg", headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in r.text
    # Senza namespace il browser non disegna il file: lo mostra come testo.
    assert 'xmlns="http://www.w3.org/2000/svg"' in r.text


def test_qr_svg_negato_a_cameriere_e_anonimi(client, tavolo, auth_header):
    url = f"/api/tables/{tavolo.id}/qr.svg"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=auth_header(UserRole.WAITER)).status_code == 403


def test_url_del_qr_punta_alla_pagina_cliente(tavolo):
    assert qr_url(tavolo) == f"{settings.frontend_url}/table/{tavolo.id}?token=token-iniziale"
