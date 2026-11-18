"""Admin centrale: gestione dei ristoranti e dei loro utenti (`/api/platform`)."""

import pytest

from app.models import AppUser, Restaurant, UserRole
from app.security import create_access_token, verify_password

PW = "password-provvisoria-12"


@pytest.fixture
def capo(make_user):
    user = make_user("capo", UserRole.SUPERADMIN, "password-capo-12")
    return {"Authorization": f"Bearer {create_access_token(user)}"}


@pytest.fixture
def gino(client, capo):
    r = client.post(
        "/api/platform/restaurants", json={"name": "Da Gino", "slug": "da-gino"}, headers=capo
    )
    assert r.status_code == 201
    return r.json()


# ---------- accesso ----------


@pytest.mark.parametrize("ruolo", [UserRole.ADMIN, UserRole.WAITER])
def test_solo_l_admin_centrale_entra(client, auth_header, ruolo):
    h = auth_header(ruolo)
    assert client.get("/api/platform/restaurants", headers=h).status_code == 403
    assert (
        client.post(
            "/api/platform/restaurants", json={"name": "X", "slug": "xxx"}, headers=h
        ).status_code
        == 403
    )


def test_senza_token_401(client):
    assert client.get("/api/platform/restaurants").status_code == 401


# ---------- ristoranti ----------


def test_crea_ed_elenca_ristoranti(client, capo, gino):
    assert gino["slug"] == "da-gino" and gino["active"] is True
    r = client.get("/api/platform/restaurants", headers=capo)
    assert [x["slug"] for x in r.json()] == ["da-gino"]
    assert r.json()[0]["users"] == 0


@pytest.mark.parametrize("slug", ["Da Gino", "ab", "admin", "-x-"])
def test_crea_ristorante_rifiuta_slug_non_valido(client, capo, slug):
    r = client.post("/api/platform/restaurants", json={"name": "X", "slug": slug}, headers=capo)
    assert r.status_code == 422


def test_crea_ristorante_rifiuta_slug_duplicato_e_nome_vuoto(client, capo, gino):
    r = client.post(
        "/api/platform/restaurants", json={"name": "Altro", "slug": "da-gino"}, headers=capo
    )
    assert r.status_code == 409
    r = client.post(
        "/api/platform/restaurants", json={"name": "  ", "slug": "da-lia"}, headers=capo
    )
    assert r.status_code == 422


def test_modifica_ristorante(client, capo, gino):
    url = f"/api/platform/restaurants/{gino['id']}"
    r = client.patch(url, json={"name": "Da Gino 2", "active": False}, headers=capo)
    assert r.status_code == 200
    assert (r.json()["name"], r.json()["active"], r.json()["slug"]) == (
        "Da Gino 2",
        False,
        "da-gino",
    )
    r = client.patch(url, json={"slug": "gino-nuovo"}, headers=capo)
    assert r.json()["slug"] == "gino-nuovo"
    assert client.patch(url, json={"slug": "Brutto Slug"}, headers=capo).status_code == 422
    assert (
        client.patch(
            "/api/platform/restaurants/99999", json={"name": "X"}, headers=capo
        ).status_code
        == 404
    )


def test_cambio_slug_in_uso_rifiutato(client, capo, gino):
    lia = client.post(
        "/api/platform/restaurants", json={"name": "Da Lia", "slug": "da-lia"}, headers=capo
    ).json()
    r = client.patch(
        f"/api/platform/restaurants/{lia['id']}", json={"slug": "da-gino"}, headers=capo
    )
    assert r.status_code == 409


# ---------- utenti di un ristorante ----------


def _crea(client, capo, ristorante, username="mario", ruolo="ADMIN", password=PW):
    return client.post(
        f"/api/platform/restaurants/{ristorante['id']}/users",
        json={"username": username, "role": ruolo, "password": password},
        headers=capo,
    )


def test_crea_utente_con_password_provvisoria(client, db, capo, gino):
    r = _crea(client, capo, gino)
    assert r.status_code == 201
    body = r.json()
    assert (body["username"], body["role"], body["active"]) == ("mario", "ADMIN", True)
    assert body["must_change_password"] is True
    assert "password" not in body and "password_hash" not in body
    user = db.get(AppUser, body["id"])
    assert user.restaurant_id == gino["id"] and verify_password(PW, user.password_hash)


def test_non_si_crea_un_admin_centrale_da_qui(client, capo, gino):
    assert _crea(client, capo, gino, ruolo="SUPERADMIN").status_code == 422


@pytest.mark.parametrize("password", ["corta", "x" * 129])
def test_password_provvisoria_valida(client, capo, gino, password):
    assert _crea(client, capo, gino, password=password).status_code == 422


@pytest.mark.parametrize("username", ["", "ab", "con spazio", "x" * 65, "è-accento"])
def test_username_valido(client, capo, gino, username):
    assert _crea(client, capo, gino, username=username).status_code == 422


def test_username_duplicato_solo_nello_stesso_ristorante(client, capo, gino):
    lia = client.post(
        "/api/platform/restaurants", json={"name": "Da Lia", "slug": "da-lia"}, headers=capo
    ).json()
    assert _crea(client, capo, gino).status_code == 201
    assert _crea(client, capo, gino).status_code == 409
    assert _crea(client, capo, lia).status_code == 201


def test_elenco_utenti_del_ristorante(client, capo, gino):
    _crea(client, capo, gino, "mario")
    _crea(client, capo, gino, "luigi", "WAITER")
    r = client.get(f"/api/platform/restaurants/{gino['id']}/users", headers=capo)
    assert [(u["username"], u["role"]) for u in r.json()] == [
        ("luigi", "WAITER"),
        ("mario", "ADMIN"),
    ]
    assert client.get("/api/platform/restaurants/99999/users", headers=capo).status_code == 404


def test_utente_di_un_altro_ristorante_404(client, capo, gino):
    lia = client.post(
        "/api/platform/restaurants", json={"name": "Da Lia", "slug": "da-lia"}, headers=capo
    ).json()
    uid = _crea(client, capo, lia, "ospite").json()["id"]
    url = f"/api/platform/restaurants/{gino['id']}/users/{uid}"
    assert client.patch(url, json={"active": False}, headers=capo).status_code == 404
    assert client.delete(url, headers=capo).status_code == 404
    assert (
        client.post(url + "/reset-password", json={"password": PW}, headers=capo).status_code == 404
    )


def test_disattiva_e_riattiva_utente(client, capo, gino):
    uid = _crea(client, capo, gino, "mario", "WAITER").json()["id"]
    url = f"/api/platform/restaurants/{gino['id']}/users/{uid}"
    assert client.patch(url, json={"active": False}, headers=capo).json()["active"] is False
    assert client.patch(url, json={"active": True}, headers=capo).json()["active"] is True


def test_cambia_ruolo(client, capo, gino):
    uid = _crea(client, capo, gino, "mario", "WAITER").json()["id"]
    url = f"/api/platform/restaurants/{gino['id']}/users/{uid}"
    assert client.patch(url, json={"role": "ADMIN"}, headers=capo).json()["role"] == "ADMIN"
    assert client.patch(url, json={"role": "SUPERADMIN"}, headers=capo).status_code == 422


def test_reset_password_imposta_quella_provvisoria(client, db, capo, gino):
    uid = _crea(client, capo, gino, "mario", "WAITER").json()["id"]
    user = db.get(AppUser, uid)
    user.must_change_password = False
    db.flush()
    url = f"/api/platform/restaurants/{gino['id']}/users/{uid}/reset-password"
    assert (
        client.post(url, json={"password": "nuova-provvisoria-1"}, headers=capo).status_code == 204
    )
    db.refresh(user)
    assert verify_password("nuova-provvisoria-1", user.password_hash)
    assert user.must_change_password is True
    assert client.post(url, json={"password": "corta"}, headers=capo).status_code == 422


def test_elimina_utente(client, db, capo, gino):
    uid = _crea(client, capo, gino, "mario", "WAITER").json()["id"]
    url = f"/api/platform/restaurants/{gino['id']}/users/{uid}"
    assert client.delete(url, headers=capo).status_code == 204
    assert db.get(AppUser, uid) is None


def test_elimina_utente_che_ha_gia_inserito_ordini_chiede_di_disattivarlo(client, db, capo, gino):
    from decimal import Decimal

    from app.models import MenuItem, OrderItem, RestaurantTable, TableSession

    uid = _crea(client, capo, gino, "mario", "WAITER").json()["id"]
    t = RestaurantTable(restaurant_id=gino["id"], number=1, qr_token="tk")
    p = MenuItem(restaurant_id=gino["id"], name="P", category="C", price=Decimal("1"))
    db.add_all([t, p])
    db.flush()
    s = TableSession(table_id=t.id, coperti=1)
    db.add(s)
    db.flush()
    db.add(
        OrderItem(
            session_id=s.id, menu_item_id=p.id, quantity=1, unit_price=Decimal("1"), added_by=uid
        )
    )
    db.flush()
    r = client.delete(f"/api/platform/restaurants/{gino['id']}/users/{uid}", headers=capo)
    assert r.status_code == 409 and "disattiv" in r.json()["detail"]
    assert db.get(AppUser, uid) is not None


def test_non_si_toglie_l_ultimo_admin_attivo(client, capo, gino):
    solo = _crea(client, capo, gino, "mario", "ADMIN").json()["id"]
    url = f"/api/platform/restaurants/{gino['id']}/users/{solo}"
    assert client.patch(url, json={"active": False}, headers=capo).status_code == 409
    assert client.patch(url, json={"role": "WAITER"}, headers=capo).status_code == 409
    assert client.delete(url, headers=capo).status_code == 409
    # Con un secondo admin si può.
    _crea(client, capo, gino, "luigi", "ADMIN")
    assert client.patch(url, json={"active": False}, headers=capo).status_code == 200


def test_ristorante_creato_si_usa_davvero(client, capo, gino):
    """Dall'admin creato dal centro si accede e si lavora solo nel proprio locale."""
    _crea(client, capo, gino, "mario", "ADMIN")
    r = client.post(
        "/api/auth/login",
        json={"username": "mario", "password": PW, "restaurant": "da-gino"},
    )
    assert r.status_code == 200 and r.json()["role"] == "ADMIN"
    assert r.json()["must_change_password"] is True
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    # Password provvisoria: finché non la cambia non può lavorare.
    assert client.post("/api/tables", json={"number": 1}, headers=h).status_code == 403
    cambio = {"current_password": PW, "new_password": "la-mia-nuova-password-1"}
    assert client.post("/api/auth/change-password", json=cambio, headers=h).status_code == 204
    assert client.post("/api/tables", json={"number": 1}, headers=h).status_code == 201
    assert (
        client.post(
            "/api/menu", json={"name": "P", "category": "C", "price": "5.00"}, headers=h
        ).status_code
        == 201
    )
    assert Restaurant is not None
