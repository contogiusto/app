"""Admin di ristorante: gestione degli utenti del proprio locale (`/api/users`), cambio password."""

import pytest

from app.models import AppUser, Restaurant, UserRole
from app.security import create_access_token, verify_password

PW = "password-provvisoria-12"


def _h(user):
    return {"Authorization": f"Bearer {create_access_token(user)}"}


@pytest.fixture
def locali(db):
    a = Restaurant(name="Da Gino", slug="da-gino")
    b = Restaurant(name="Da Lia", slug="da-lia")
    db.add_all([a, b])
    db.flush()
    return a, b


@pytest.fixture
def admin(db, make_user, locali):
    return make_user("admin-a", UserRole.ADMIN, "una-password-lunga-1", restaurant=locali[0])


@pytest.fixture
def h(admin):
    return _h(admin)


# ---------- accesso ----------


def test_serve_il_token_e_il_ruolo_admin(client, make_user, locali):
    assert client.get("/api/users").status_code == 401
    waiter = make_user("w", UserRole.WAITER, restaurant=locali[0])
    assert client.get("/api/users", headers=_h(waiter)).status_code == 403
    capo = make_user("capo", UserRole.SUPERADMIN)
    assert client.get("/api/users", headers=_h(capo)).status_code == 403


# ---------- elenco e creazione ----------


def test_elenco_solo_del_proprio_ristorante(client, make_user, locali, h):
    make_user("cameriere", UserRole.WAITER, restaurant=locali[0])
    make_user("altrove", UserRole.WAITER, restaurant=locali[1])
    r = client.get("/api/users", headers=h)
    assert [u["username"] for u in r.json()] == ["admin-a", "cameriere"]


def test_crea_utente_nel_proprio_ristorante(client, db, locali, h):
    r = client.post(
        "/api/users", json={"username": "anna", "role": "WAITER", "password": PW}, headers=h
    )
    assert r.status_code == 201
    assert r.json()["must_change_password"] is True
    user = db.get(AppUser, r.json()["id"])
    assert user.restaurant_id == locali[0].id and verify_password(PW, user.password_hash)


@pytest.mark.parametrize(
    "body", [{"role": "SUPERADMIN"}, {"password": "corta"}, {"username": "x y"}]
)
def test_creazione_validata(client, h, body):
    data = {"username": "anna", "role": "WAITER", "password": PW, **body}
    assert client.post("/api/users", json=data, headers=h).status_code == 422


def test_username_duplicato_nel_proprio_locale(client, h):
    body = {"username": "anna", "role": "WAITER", "password": PW}
    assert client.post("/api/users", json=body, headers=h).status_code == 201
    assert client.post("/api/users", json=body, headers=h).status_code == 409


# ---------- modifica: solo utenti propri ----------


def test_utente_di_un_altro_locale_404(client, make_user, locali, h):
    estraneo = make_user("estraneo", UserRole.WAITER, restaurant=locali[1])
    url = f"/api/users/{estraneo.id}"
    assert client.patch(url, json={"active": False}, headers=h).status_code == 404
    assert client.delete(url, headers=h).status_code == 404
    assert client.post(url + "/reset-password", json={"password": PW}, headers=h).status_code == 404


def test_disattiva_cambia_ruolo_reimposta_elimina(client, db, make_user, locali, h):
    w = make_user("cameriere", UserRole.WAITER, restaurant=locali[0])
    url = f"/api/users/{w.id}"
    assert client.patch(url, json={"active": False}, headers=h).json()["active"] is False
    assert client.patch(url, json={"role": "ADMIN"}, headers=h).json()["role"] == "ADMIN"
    assert client.post(url + "/reset-password", json={"password": PW}, headers=h).status_code == 204
    db.refresh(w)
    assert verify_password(PW, w.password_hash) and w.must_change_password is True
    assert client.delete(url, headers=h).status_code == 204


def test_non_si_agisce_su_se_stessi(client, admin, make_user, locali, h):
    make_user("secondo", UserRole.ADMIN, restaurant=locali[0])
    url = f"/api/users/{admin.id}"
    assert client.patch(url, json={"active": False}, headers=h).status_code == 409
    assert client.patch(url, json={"role": "WAITER"}, headers=h).status_code == 409
    assert client.delete(url, headers=h).status_code == 409
    # La propria password si cambia da /api/auth/change-password, non da qui.
    assert client.post(url + "/reset-password", json={"password": PW}, headers=h).status_code == 409


# ---------- cambio password ----------


def test_cambio_password_azzera_il_flag(client, db, make_user, locali):
    user = make_user("nuovo", UserRole.WAITER, PW, restaurant=locali[0])
    user.must_change_password = True
    db.flush()
    h = _h(user)
    r = client.post(
        "/api/auth/change-password",
        json={"current_password": PW, "new_password": "una-nuova-password-1"},
        headers=h,
    )
    assert r.status_code == 204
    db.refresh(user)
    assert user.must_change_password is False
    assert verify_password("una-nuova-password-1", user.password_hash)


def test_cambio_password_rifiutato(client, make_user, locali):
    user = make_user("nuovo", UserRole.WAITER, PW, restaurant=locali[0])
    h = _h(user)
    url = "/api/auth/change-password"
    sbagliata = {"current_password": "sbagliata-sbagliata", "new_password": "una-nuova-password-1"}
    assert client.post(url, json=sbagliata, headers=h).status_code == 403
    uguale = {"current_password": PW, "new_password": PW}
    assert client.post(url, json=uguale, headers=h).status_code == 422
    corta = {"current_password": PW, "new_password": "corta"}
    assert client.post(url, json=corta, headers=h).status_code == 422
    assert client.post(url, json=uguale).status_code == 401


def test_con_password_da_cambiare_le_altre_rotte_sono_bloccate(client, db, make_user, locali):
    user = make_user("nuovo", UserRole.ADMIN, PW, restaurant=locali[0])
    user.must_change_password = True
    db.flush()
    h = _h(user)
    r = client.get("/api/tables", headers=h)
    assert r.status_code == 403 and "cambiare la password" in r.json()["detail"]
    assert client.get("/api/users", headers=h).status_code == 403
    me = client.get("/api/auth/me", headers=h)
    assert me.status_code == 200 and me.json()["must_change_password"] is True
    user.must_change_password = False
    db.flush()
    assert client.get("/api/tables", headers=h).status_code == 200


def test_il_superadmin_con_password_da_cambiare_e_bloccato_sulla_piattaforma(client, db, make_user):
    capo = make_user("capo", UserRole.SUPERADMIN, PW)
    capo.must_change_password = True
    db.flush()
    assert client.get("/api/platform/restaurants", headers=_h(capo)).status_code == 403


def test_il_login_dice_se_la_password_va_cambiata_e_il_ristorante(client, db, make_user, locali):
    user = make_user("nuovo", UserRole.WAITER, PW, restaurant=locali[0])
    user.must_change_password = True
    db.flush()
    r = client.post(
        "/api/auth/login", json={"username": "nuovo", "password": PW, "restaurant": "da-gino"}
    )
    body = r.json()
    assert body["must_change_password"] is True and body["restaurant_slug"] == "da-gino"
    capo = make_user("capo", UserRole.SUPERADMIN, PW)
    r = client.post("/api/auth/login", json={"username": "capo", "password": PW})
    assert r.json()["restaurant_slug"] is None and capo.id
