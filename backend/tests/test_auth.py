from datetime import timedelta

import jwt
import pytest

from app.config import settings
from app.models import UserRole
from app.security import create_access_token


def test_login_corretto_restituisce_token_e_ruolo(client, make_user):
    make_user("mario", UserRole.WAITER, "segreta")
    r = client.post("/api/auth/login", json={"username": "mario", "password": "segreta"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["role"] == "WAITER"
    payload = jwt.decode(body["access_token"], settings.jwt_secret, algorithms=["HS256"])
    assert payload["role"] == "WAITER"


@pytest.mark.parametrize("username,password", [("mario", "sbagliata"), ("inesistente", "segreta")])
def test_login_rifiutato_con_stesso_errore(client, make_user, username, password):
    make_user("mario", UserRole.WAITER, "segreta")
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 401
    assert r.json()["detail"] == "Credenziali non valide"


def test_me_senza_token_401(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_con_token_valido(client, auth_header):
    r = client.get("/api/auth/me", headers=auth_header(UserRole.ADMIN))
    assert r.status_code == 200
    assert r.json()["role"] == "ADMIN"


def test_token_scaduto_401(client, make_user):
    user = make_user("scaduto", UserRole.ADMIN)
    token = create_access_token(user, expires_in=timedelta(seconds=-1))
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_token_manomesso_401(client, make_user):
    user = make_user("falso", UserRole.ADMIN)
    token = jwt.encode({"sub": str(user.id), "role": "ADMIN"}, "altra-chiave", algorithm="HS256")
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_utente_eliminato_401(client, db, make_user):
    user = make_user("fantasma", UserRole.ADMIN)
    token = create_access_token(user)
    db.delete(user)
    db.flush()
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
