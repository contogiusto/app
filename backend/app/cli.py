"""Comandi di amministrazione. Uso (da backend/):

    uv run python -m app.cli create-restaurant <slug> <nome>
    uv run python -m app.cli create-user <username> <SUPERADMIN|ADMIN|WAITER> [--restaurant <slug>]
    uv run python -m app.cli promote-superadmin <username> [--restaurant <slug>]
    uv run python -m app.cli list-users
    uv run python -m app.cli reset-password <username> [--restaurant <slug>]

ADMIN e WAITER appartengono a un ristorante (`--restaurant`); il SUPERADMIN (admin centrale) no.
Lo stesso username può esistere in ristoranti diversi: `--restaurant` dice quale.
La password viene chiesta in modo interattivo (non compare nella cronologia della shell).
Le password non sono recuperabili (sono hash): si può solo sostituirle con `reset-password`.
Il database è quello di DATABASE_URL.
"""

import argparse
import getpass
import sys
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import AppUser, Restaurant, UserRole
from app.security import hash_password
from app.slugs import valid_slug

MIN_PASSWORD_LENGTH = 12


def _check_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"La password deve avere almeno {MIN_PASSWORD_LENGTH} caratteri")


def create_restaurant(db: Session, slug: str, name: str) -> Restaurant:
    if not valid_slug(slug):
        raise ValueError(
            f"Slug '{slug}' non valido: 3-40 caratteri tra a-z, 0-9 e '-' (non agli estremi, "
            "non doppi) e non riservato"
        )
    if db.scalar(select(Restaurant).where(Restaurant.slug == slug)):
        raise ValueError(f"Esiste già un ristorante con slug '{slug}'")
    if not name.strip():
        raise ValueError("Il nome del ristorante è obbligatorio")
    restaurant = Restaurant(name=name.strip(), slug=slug)
    db.add(restaurant)
    db.flush()
    return restaurant


def get_restaurant(db: Session, slug: str) -> Restaurant:
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == slug))
    if restaurant is None:
        raise ValueError(f"Il ristorante '{slug}' non esiste")
    return restaurant


def _find_user(db: Session, username: str, slug: str | None) -> AppUser:
    """L'utente `username` di un ristorante (`slug`) o, senza slug, un admin centrale."""
    query = select(AppUser).where(AppUser.username == username)
    if slug is None:
        query = query.where(AppUser.restaurant_id.is_(None))
    else:
        query = query.where(AppUser.restaurant_id == get_restaurant(db, slug).id)
    user = db.scalar(query)
    if user is None:
        dove = f"nel ristorante '{slug}'" if slug else "tra gli admin centrali"
        raise ValueError(f"L'utente '{username}' non esiste {dove}")
    return user


def create_user(
    db: Session,
    username: str,
    role: UserRole,
    password: str,
    restaurant: Restaurant | None = None,
) -> AppUser:
    _check_password(password)
    if role == UserRole.SUPERADMIN and restaurant is not None:
        raise ValueError("L'admin centrale non appartiene a un ristorante")
    if role != UserRole.SUPERADMIN and restaurant is None:
        raise ValueError(f"Un {role.value} appartiene a un ristorante: indica --restaurant")
    restaurant_id = restaurant.id if restaurant else None
    esiste = db.scalar(
        select(AppUser).where(
            AppUser.username == username,
            AppUser.restaurant_id.is_(None)
            if restaurant_id is None
            else AppUser.restaurant_id == restaurant_id,
        )
    )
    if esiste:
        raise ValueError(f"L'utente '{username}' già esiste")
    user = AppUser(
        username=username,
        password_hash=hash_password(password),
        role=role,
        restaurant_id=restaurant_id,
    )
    db.add(user)
    db.flush()
    return user


def promote_superadmin(db: Session, username: str, slug: str | None = None) -> AppUser:
    """Porta un utente dello staff a admin centrale (senza ristorante).

    Senza `slug` l'utente dev'essere uno solo con quel nome in tutta l'app.
    """
    if slug is not None:
        user = _find_user(db, username, slug)
    else:
        trovati = list(
            db.scalars(
                select(AppUser).where(
                    AppUser.username == username, AppUser.role != UserRole.SUPERADMIN
                )
            )
        )
        if not trovati:
            raise ValueError(f"L'utente '{username}' non esiste")
        if len(trovati) > 1:
            raise ValueError(f"Più utenti si chiamano '{username}': indica --restaurant")
        user = trovati[0]
    if user.role == UserRole.SUPERADMIN:
        raise ValueError(f"'{username}' è già admin centrale")
    if db.scalar(
        select(AppUser).where(AppUser.username == username, AppUser.restaurant_id.is_(None))
    ):
        raise ValueError(f"Esiste già un admin centrale '{username}'")
    user.role = UserRole.SUPERADMIN
    user.restaurant_id = None
    db.flush()
    return user


@dataclass(frozen=True)
class UserRow:
    id: int
    username: str
    role: UserRole
    restaurant: str | None  # slug; None per l'admin centrale
    active: bool


def list_users(db: Session) -> list[UserRow]:
    """Utenti dello staff in ordine (centrali, poi per ristorante). Mai gli hash."""
    rows = db.execute(
        select(AppUser, Restaurant.slug)
        .outerjoin(Restaurant, Restaurant.id == AppUser.restaurant_id)
        .order_by(AppUser.restaurant_id.is_not(None), Restaurant.slug, AppUser.username)
    ).all()
    return [UserRow(u.id, u.username, u.role, slug, u.active) for u, slug in rows]


def reset_password(db: Session, username: str, password: str, slug: str | None = None) -> AppUser:
    _check_password(password)
    if slug is None:
        # Senza ristorante vale solo se il nome è univoco in tutta l'app.
        trovati = list(db.scalars(select(AppUser).where(AppUser.username == username)))
        if not trovati:
            raise ValueError(f"L'utente '{username}' non esiste")
        if len(trovati) > 1:
            raise ValueError(f"Più utenti si chiamano '{username}': indica --restaurant")
        user = trovati[0]
    else:
        user = _find_user(db, username, slug)
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

    rest = sub.add_parser("create-restaurant", help="crea un ristorante")
    rest.add_argument("slug")
    rest.add_argument("name")

    create = sub.add_parser("create-user", help="crea un utente dello staff")
    create.add_argument("username")
    create.add_argument("role", type=UserRole, choices=list(UserRole))
    create.add_argument("--restaurant", help="slug del ristorante (non per SUPERADMIN)")

    promote = sub.add_parser("promote-superadmin", help="porta un utente a admin centrale")
    promote.add_argument("username")
    promote.add_argument("--restaurant", help="slug del ristorante dell'utente")

    sub.add_parser("list-users", help="elenca gli utenti dello staff")

    reset = sub.add_parser("reset-password", help="imposta una nuova password a un utente")
    reset.add_argument("username")
    reset.add_argument("--restaurant", help="slug del ristorante dell'utente")
    args = parser.parse_args(argv)

    if args.command == "list-users":
        with SessionLocal() as db:
            for u in list_users(db):
                stato = "" if u.active else "\t(disattivato)"
                print(f"{u.id}\t{u.username}\t{u.role.value}\t{u.restaurant or '-'}{stato}")
        return 0

    if args.command == "create-restaurant":
        with SessionLocal() as db:
            try:
                restaurant = create_restaurant(db, args.slug, args.name)
            except ValueError as exc:
                print(exc, file=sys.stderr)
                return 1
            db.commit()
        print(f"Creato il ristorante '{restaurant.name}' (/ristorante/{restaurant.slug})")
        return 0

    if args.command == "promote-superadmin":
        with SessionLocal() as db:
            try:
                user = promote_superadmin(db, args.username, args.restaurant)
            except ValueError as exc:
                print(exc, file=sys.stderr)
                return 1
            db.commit()
        print(f"'{user.username}' è ora admin centrale")
        return 0

    password = _ask_password()
    if password is None:
        return 1

    with SessionLocal() as db:
        try:
            if args.command == "reset-password":
                user = reset_password(db, args.username, password, args.restaurant)
                message = f"Password aggiornata per '{user.username}'"
            else:
                restaurant = get_restaurant(db, args.restaurant) if args.restaurant else None
                user = create_user(db, args.username, args.role, password, restaurant)
                message = f"Creato {user.role.value} '{user.username}'"
        except ValueError as exc:
            print(exc, file=sys.stderr)
            return 1
        db.commit()
    print(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
