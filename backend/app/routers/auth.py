import hashlib

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ratelimit
from app.config import settings
from app.deps import CurrentUser, DbSession
from app.models import AppUser, Restaurant, UserRole
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _trova_utente(db: Session, username: str, slug: str | None) -> AppUser | None:
    """L'utente che sta accedendo, o None (anche se utente o ristorante sono disattivati).

    Con `slug` solo lo staff di quel ristorante; senza, l'admin centrale. Finché il frontend non
    invia lo slug (fase 3c) senza slug si accetta anche uno staff con username univoco: va tolto
    nella fase 3d.
    """
    if slug is not None:
        candidati = list(
            db.scalars(
                select(AppUser)
                .join(Restaurant, Restaurant.id == AppUser.restaurant_id)
                .where(Restaurant.slug == slug, AppUser.username == username)
            )
        )
    else:
        candidati = list(
            db.scalars(
                select(AppUser).where(
                    AppUser.username == username, AppUser.role == UserRole.SUPERADMIN
                )
            )
        ) or list(
            db.scalars(
                select(AppUser).where(
                    AppUser.username == username, AppUser.restaurant_id.is_not(None)
                )
            )
        )
    if len(candidati) != 1:
        return None
    user = candidati[0]
    if not user.active:
        return None
    if user.restaurant_id is not None and not db.get(Restaurant, user.restaurant_id).active:
        return None
    return user


@router.post("/login")
def login(data: LoginRequest, request: Request, db: DbSession) -> TokenResponse:
    # Si contano solo i tentativi falliti, per IP e per username: chi accede correttamente
    # non viene mai fermato (nemmeno da un IP condiviso). Esaurito il limite, anche la
    # password giusta aspetta, altrimenti il limite non fermerebbe chi sta indovinando.
    ip = ratelimit.ip_client(request.headers, request.client and request.client.host)
    slug = data.restaurant.strip().lower() if data.restaurant else None
    nome = hashlib.sha256(f"{slug}:{data.username.strip().lower()}".encode()).hexdigest()[:32]
    per_ip = (f"login-ip:{ip}", settings.rate_limit_login_ip_max)
    per_utente = (f"login-user:{nome}", settings.rate_limit_login_user_max)
    finestra = settings.rate_limit_login_window
    for chiave, massimo in (per_ip, per_utente):
        ratelimit.verifica(chiave, massimo, finestra)

    user = _trova_utente(db, data.username, slug)
    # Stesso errore (e stesso costo di calcolo) per utente inesistente e password errata.
    if not verify_password(data.password, user.password_hash if user else None) or user is None:
        for chiave, massimo in (per_ip, per_utente):
            ratelimit.colpisci(chiave, massimo, finestra)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenziali non valide")
    return TokenResponse(access_token=create_access_token(user), role=user.role)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
