from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import AppUser
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(data: LoginRequest, db: DbSession) -> TokenResponse:
    user = db.scalar(select(AppUser).where(AppUser.username == data.username))
    # Stesso errore (e stesso costo di calcolo) per utente inesistente e password errata.
    if not verify_password(data.password, user.password_hash if user else None) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenziali non valide")
    return TokenResponse(access_token=create_access_token(user), role=user.role)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
