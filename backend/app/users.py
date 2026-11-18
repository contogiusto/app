"""Gestione degli utenti dello staff di un ristorante.

Usata dall'admin centrale (`/api/platform`) e dall'admin del ristorante (`/api/users`): le regole
sono le stesse, cambia solo chi può farlo. Gli errori sono `DomainError` (404/409/422).
"""

from datetime import UTC, datetime

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.errors import Conflict, Invalid, NotFound
from app.models import AppUser, OrderItem, Restaurant, UserRole
from app.security import hash_password

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128
RUOLI_DI_RISTORANTE = (UserRole.ADMIN, UserRole.WAITER)


def _controlla_password(password: str) -> None:
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise Invalid(
            f"La password deve avere tra {MIN_PASSWORD_LENGTH} e {MAX_PASSWORD_LENGTH} caratteri"
        )


def _controlla_ruolo(role: UserRole) -> None:
    if role not in RUOLI_DI_RISTORANTE:
        raise Invalid("Il ruolo dev'essere ADMIN o WAITER")


def utente_del_ristorante(db: Session, restaurant_id: int, user_id: int) -> AppUser:
    """404 se l'utente non esiste o è di un altro ristorante."""
    user = db.get(AppUser, user_id)
    if user is None or user.restaurant_id != restaurant_id:
        raise NotFound("Utente non trovato")
    return user


def elenco_utenti(db: Session, restaurant_id: int) -> list[AppUser]:
    return list(
        db.scalars(
            select(AppUser).where(AppUser.restaurant_id == restaurant_id).order_by(AppUser.username)
        )
    )


def crea_utente(
    db: Session, restaurant_id: int, username: str, role: UserRole, password: str
) -> AppUser:
    _controlla_ruolo(role)
    _controlla_password(password)
    esiste = db.scalar(
        select(AppUser.id).where(
            AppUser.restaurant_id == restaurant_id, AppUser.username == username
        )
    )
    if esiste is not None:
        raise Conflict("Esiste già un utente con questo nome in questo ristorante")
    user = AppUser(
        restaurant_id=restaurant_id,
        username=username,
        password_hash=hash_password(password),
        role=role,
        must_change_password=True,  # la password l'ha scelta chi lo ha creato
    )
    db.add(user)
    db.flush()
    return user


def _e_ultimo_admin_attivo(db: Session, user: AppUser) -> bool:
    if user.role != UserRole.ADMIN or not user.active:
        return False
    # Due admin che si tolgono a vicenda nello stesso istante: si serializza sul ristorante.
    db.execute(select(Restaurant.id).where(Restaurant.id == user.restaurant_id).with_for_update())
    altri = db.scalar(
        select(func.count()).where(
            AppUser.restaurant_id == user.restaurant_id,
            AppUser.role == UserRole.ADMIN,
            AppUser.active.is_(True),
            AppUser.id != user.id,
        )
    )
    return altri == 0


def _non_ultimo_admin(db: Session, user: AppUser) -> None:
    if _e_ultimo_admin_attivo(db, user):
        raise Conflict("È l'ultimo admin attivo del ristorante: creane prima un altro")


def imposta_attivo(db: Session, user: AppUser, active: bool) -> AppUser:
    if not active:
        _non_ultimo_admin(db, user)
    user.active = active
    db.flush()
    return user


def cambia_ruolo(db: Session, user: AppUser, role: UserRole) -> AppUser:
    _controlla_ruolo(role)
    if role != UserRole.ADMIN:
        _non_ultimo_admin(db, user)
    user.role = role
    db.flush()
    return user


def reimposta_password(db: Session, user: AppUser, password: str) -> AppUser:
    _controlla_password(password)
    user.password_hash = hash_password(password)
    user.must_change_password = True
    user.password_changed_at = datetime.now(UTC)  # i suoi token attuali non valgono più
    db.flush()
    return user


def elimina_utente(db: Session, user: AppUser) -> None:
    _non_ultimo_admin(db, user)
    if db.scalar(select(exists().where(OrderItem.added_by == user.id))):
        # Gli ordini passati puntano a lui: si disattiva invece di cancellarlo.
        raise Conflict("Ha già inserito ordini: disattivalo invece di eliminarlo")
    db.delete(user)
    db.flush()
