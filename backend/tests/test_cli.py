import pytest
from sqlalchemy import select

from app.cli import create_user, list_users, main, reset_password
from app.models import AppUser, UserRole
from app.security import verify_password


def test_crea_utente_con_password_hashata(db):
    user = create_user(db, "admin", UserRole.ADMIN, "una-password-lunga-12")
    saved = db.scalar(select(AppUser).where(AppUser.username == "admin"))
    assert saved.id == user.id
    assert saved.password_hash != "una-password-lunga-12"
    assert verify_password("una-password-lunga-12", saved.password_hash)


def test_rifiuta_password_corta(db):
    with pytest.raises(ValueError, match="almeno 12"):
        create_user(db, "admin", UserRole.ADMIN, "corta")


def test_rifiuta_username_gia_esistente(db):
    create_user(db, "admin", UserRole.ADMIN, "una-password-lunga-12")
    with pytest.raises(ValueError, match="già esiste"):
        create_user(db, "admin", UserRole.WAITER, "un-altra-password-12")


def test_elenca_utenti_ordinati_senza_hash(db):
    create_user(db, "zeta", UserRole.WAITER, "una-password-lunga-12")
    create_user(db, "alfa", UserRole.ADMIN, "una-password-lunga-12")
    rows = list_users(db)
    assert [(r.username, r.role) for r in rows] == [
        ("alfa", UserRole.ADMIN),
        ("zeta", UserRole.WAITER),
    ]


def test_reset_password_cambia_solo_la_password(db):
    user = create_user(db, "mario", UserRole.WAITER, "vecchia-password-12")
    reset_password(db, "mario", "nuova-password-lunga-12")
    db.refresh(user)
    assert verify_password("nuova-password-lunga-12", user.password_hash)
    assert not verify_password("vecchia-password-12", user.password_hash)
    assert user.role == UserRole.WAITER


def test_reset_password_rifiuta_utente_inesistente(db):
    with pytest.raises(ValueError, match="non esiste"):
        reset_password(db, "nessuno", "nuova-password-lunga-12")


def test_reset_password_rifiuta_password_corta(db):
    create_user(db, "mario", UserRole.WAITER, "vecchia-password-12")
    with pytest.raises(ValueError, match="almeno 12"):
        reset_password(db, "mario", "corta")


def test_main_list_users_stampa_utenti(capsys, monkeypatch, db):
    create_user(db, "mario", UserRole.WAITER, "una-password-lunga-12")
    db.commit = lambda: None  # la sessione di test resta annullabile
    monkeypatch.setattr("app.cli.SessionLocal", lambda: _Ctx(db))
    assert main(["list-users"]) == 0
    out = capsys.readouterr().out
    assert "mario" in out and "WAITER" in out
    assert "argon2" not in out


class _Ctx:
    def __init__(self, session):
        self.session = session

    def __enter__(self):
        return self.session

    def __exit__(self, *exc):
        return False
