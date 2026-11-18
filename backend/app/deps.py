"""Dipendenze FastAPI: utente corrente e controllo dei ruoli."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import NotFound
from app.models import AppUser, Customer, Restaurant, RestaurantTable, TableSession, UserRole
from app.security import CUSTOMER, STAFF, decode_access_token, token_type

DbSession = Annotated[Session, Depends(get_db)]
_bearer = HTTPBearer(auto_error=False)


def _non_autenticato() -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Autenticazione richiesta",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AppUser:
    if credentials is None:
        raise _non_autenticato()
    try:
        payload = decode_access_token(credentials.credentials)
        if token_type(payload) != STAFF:
            raise _non_autenticato()
        user = db.get(AppUser, int(payload["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise _non_autenticato() from None
    # Utente disattivato o locale disattivato: il token smette di valere subito.
    if user is None or not user.active:
        raise _non_autenticato()
    changed = user.password_changed_at
    if changed is not None and payload.get("iat", 0) < int(changed.timestamp()):
        raise _non_autenticato()  # token emesso prima dell'ultimo cambio di password
    if user.restaurant_id is not None and not db.get(Restaurant, user.restaurant_id).active:
        raise _non_autenticato()
    return user


CurrentUser = Annotated[AppUser, Depends(get_current_user)]


def _cliente_dal_token(db: Session, token: str) -> Customer | None:
    """Il cliente a cui appartiene il token, o None se non è valido (scaduto, manomesso,
    di un altro tipo o di un account eliminato)."""
    try:
        payload = decode_access_token(token)
        if token_type(payload) != CUSTOMER:
            return None
        customer = db.get(Customer, int(payload["sub"]))
        changed = customer.password_changed_at if customer else None
        if changed is not None and payload.get("iat", 0) < int(changed.timestamp()):
            return None  # emesso prima dell'ultimo cambio di password
        return customer
    except (jwt.PyJWTError, ValueError):
        return None


def get_current_customer(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Customer:
    customer = _cliente_dal_token(db, credentials.credentials) if credentials else None
    if customer is None:
        raise _non_autenticato()
    return customer


def get_optional_customer(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Customer | None:
    """Per gli endpoint aperti a tutti: se c'è un token cliente valido si lega l'azione
    all'account, altrimenti si procede come ospite (mai un errore: al tavolo non si blocca)."""
    return _cliente_dal_token(db, credentials.credentials) if credentials else None


CurrentCustomer = Annotated[Customer, Depends(get_current_customer)]
OptionalCustomer = Annotated[Customer | None, Depends(get_optional_customer)]


def require_roles(*roles: UserRole):
    """Dipendenza che ammette solo gli utenti con uno dei ruoli indicati."""

    def checker(user: CurrentUser) -> AppUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Permessi insufficienti")
        if user.must_change_password:
            # Password provvisoria: prima si cambia (solo /api/auth/me e /change-password restano).
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Devi cambiare la password prima di continuare"
            )
        return user

    return checker


def _operativo(*roles: UserRole):
    """Ruoli di un ristorante: servono anche un ristorante di appartenenza (altrimenti 403)."""
    controlla_ruolo = require_roles(*roles)

    def checker(user: Annotated[AppUser, Depends(controlla_ruolo)]) -> AppUser:
        if user.restaurant_id is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Utente non associato a un ristorante")
        return user

    return checker


AdminUser = Annotated[AppUser, Depends(_operativo(UserRole.ADMIN))]
StaffUser = Annotated[AppUser, Depends(_operativo(UserRole.ADMIN, UserRole.WAITER))]
PlatformUser = Annotated[AppUser, Depends(require_roles(UserRole.SUPERADMIN))]


def _id_ristorante(user: StaffUser) -> int:
    assert user.restaurant_id is not None  # garantito da _operativo
    return user.restaurant_id


# Il ristorante dell'utente dello staff: ogni query dei dati di un locale deve filtrare per questo.
RestaurantId = Annotated[int, Depends(_id_ristorante)]


def _sessione_del_ristorante(session_id: int, db: DbSession, restaurant_id: RestaurantId) -> int:
    """404 se la sessione non esiste o è di un altro ristorante (non si rivela quale)."""
    trovata = db.scalar(
        select(TableSession.id)
        .join(RestaurantTable, RestaurantTable.id == TableSession.table_id)
        .where(TableSession.id == session_id, RestaurantTable.restaurant_id == restaurant_id)
    )
    if trovata is None:
        raise NotFound("Sessione non trovata")
    return trovata


# Da usare come `dependencies=[SessioneDelRistorante]` negli endpoint con `session_id` nel path.
SessioneDelRistorante = Depends(_sessione_del_ristorante)
