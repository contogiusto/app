import pytest
from sqlalchemy import select

from app.cli import create_user
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
