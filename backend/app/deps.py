"""Dipendenze FastAPI: utente corrente e controllo dei ruoli."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AppUser, Customer, UserRole
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
    if user is None:
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
        return db.get(Customer, int(payload["sub"]))
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
        return user

    return checker


AdminUser = Annotated[AppUser, Depends(require_roles(UserRole.ADMIN))]
StaffUser = Annotated[AppUser, Depends(require_roles(UserRole.ADMIN, UserRole.WAITER))]
