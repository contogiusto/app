"""Comandi di amministrazione. Uso (da backend/):

    uv run python -m app.cli create-user <username> <ADMIN|WAITER>

La password viene chiesta in modo interattivo (non compare nella cronologia della shell).
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-user", help="crea un utente dello staff")
    create.add_argument("username")
    create.add_argument("role", type=UserRole, choices=list(UserRole))
    args = parser.parse_args(argv)

    password = getpass.getpass("Password: ")
    if getpass.getpass("Ripeti la password: ") != password:
        print("Le password non coincidono", file=sys.stderr)
        return 1

    with SessionLocal() as db:
        try:
            user = create_user(db, args.username, args.role, password)
        except ValueError as exc:
            print(exc, file=sys.stderr)
            return 1
        db.commit()
    print(f"Creato {user.role.value} '{user.username}'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
