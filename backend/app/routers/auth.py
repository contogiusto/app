import hashlib

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app import ratelimit
from app.config import settings
from app.deps import CurrentUser, DbSession
from app.models import AppUser
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(data: LoginRequest, request: Request, db: DbSession) -> TokenResponse:
    # Si contano solo i tentativi falliti, per IP e per username: chi accede correttamente
    # non viene mai fermato (nemmeno da un IP condiviso). Esaurito il limite, anche la
    # password giusta aspetta, altrimenti il limite non fermerebbe chi sta indovinando.
    ip = ratelimit.ip_client(request.headers, request.client and request.client.host)
    nome = hashlib.sha256(data.username.strip().lower().encode()).hexdigest()[:32]
    per_ip = (f"login-ip:{ip}", settings.rate_limit_login_ip_max)
    per_utente = (f"login-user:{nome}", settings.rate_limit_login_user_max)
    finestra = settings.rate_limit_login_window
    for chiave, massimo in (per_ip, per_utente):
        ratelimit.verifica(chiave, massimo, finestra)

    user = db.scalar(select(AppUser).where(AppUser.username == data.username))
    # Stesso errore (e stesso costo di calcolo) per utente inesistente e password errata.
    if not verify_password(data.password, user.password_hash if user else None) or user is None:
        for chiave, massimo in (per_ip, per_utente):
            ratelimit.colpisci(chiave, massimo, finestra)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenziali non valide")
    return TokenResponse(access_token=create_access_token(user), role=user.role)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
