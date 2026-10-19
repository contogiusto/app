"""Dipendenze FastAPI: utente corrente e controllo dei ruoli."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AppUser, UserRole
from app.security import decode_access_token

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
        user = db.get(AppUser, int(payload["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise _non_autenticato() from None
    if user is None:
        raise _non_autenticato()
    return user


CurrentUser = Annotated[AppUser, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    """Dipendenza che ammette solo gli utenti con uno dei ruoli indicati."""

    def checker(user: CurrentUser) -> AppUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Permessi insufficienti")
        return user

    return checker


AdminUser = Annotated[AppUser, Depends(require_roles(UserRole.ADMIN))]
StaffUser = Annotated[AppUser, Depends(require_roles(UserRole.ADMIN, UserRole.WAITER))]
