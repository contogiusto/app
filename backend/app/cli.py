"""Comandi di amministrazione. Uso (da backend/):

    uv run python -m app.cli create-user <username> <ADMIN|WAITER>
    uv run python -m app.cli list-users
    uv run python -m app.cli reset-password <username>

La password viene chiesta in modo interattivo (non compare nella cronologia della shell).
Le password non sono recuperabili (sono hash): si può solo sostituirle con `reset-password`.
Il database è quello di DATABASE_URL.
"""

import argparse
import getpass
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import AppUser, UserRole
from app.security import hash_password

MIN_PASSWORD_LENGTH = 12


def create_user(db: Session, username: str, role: UserRole, password: str) -> AppUser:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"La password deve avere almeno {MIN_PASSWORD_LENGTH} caratteri")
    if db.scalar(select(AppUser).where(AppUser.username == username)):
        raise ValueError(f"L'utente '{username}' già esiste")
    user = AppUser(username=username, password_hash=hash_password(password), role=role)
    db.add(user)
    db.flush()
    return user


def list_users(db: Session) -> list[AppUser]:
    """Utenti dello staff in ordine alfabetico (mai gli hash delle password)."""
    return list(db.scalars(select(AppUser).order_by(AppUser.username)))


def reset_password(db: Session, username: str, password: str) -> AppUser:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"La password deve avere almeno {MIN_PASSWORD_LENGTH} caratteri")
    user = db.scalar(select(AppUser).where(AppUser.username == username))
    if user is None:
        raise ValueError(f"L'utente '{username}' non esiste")
    user.password_hash = hash_password(password)
    db.flush()
    return user


def _ask_password() -> str | None:
    password = getpass.getpass("Password: ")
    if getpass.getpass("Ripeti la password: ") != password:
        print("Le password non coincidono", file=sys.stderr)
        return None
    return password


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-user", help="crea un utente dello staff")
    create.add_argument("username")
    create.add_argument("role", type=UserRole, choices=list(UserRole))
    sub.add_parser("list-users", help="elenca gli utenti dello staff")
    reset = sub.add_parser("reset-password", help="imposta una nuova password a un utente")
    reset.add_argument("username")
    args = parser.parse_args(argv)

    if args.command == "list-users":
        with SessionLocal() as db:
            for user in list_users(db):
                print(f"{user.id}	{user.username}	{user.role.value}")
        return 0

    password = _ask_password()
    if password is None:
        return 1

    with SessionLocal() as db:
        try:
            if args.command == "reset-password":
                user = reset_password(db, args.username, password)
                message = f"Password aggiornata per '{user.username}'"
            else:
                user = create_user(db, args.username, args.role, password)
                message = f"Creato {user.role.value} '{user.username}'"
        except ValueError as exc:
            print(exc, file=sys.stderr)
            return 1
        db.commit()
    print(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
