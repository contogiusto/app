import hashlib
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ratelimit
from app.config import settings
from app.deps import CurrentUser, DbSession
from app.errors import Invalid
from app.models import AppUser, Restaurant, UserRole
from app.schemas import ChangePasswordIn, LoginRequest, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _trova_utente(db: Session, username: str, slug: str | None) -> AppUser | None:
    """L'utente che sta accedendo, o None (anche se utente o ristorante sono disattivati).

    Con `slug` solo lo staff di quel ristorante; senza, solo l'admin centrale.
    """
    if slug is not None:
        query = (
            select(AppUser)
            .join(Restaurant, Restaurant.id == AppUser.restaurant_id)
            .where(Restaurant.slug == slug, AppUser.username == username)
        )
    else:
        query = select(AppUser).where(
            AppUser.username == username, AppUser.role == UserRole.SUPERADMIN
        )
    user = db.scalar(query)
    if user is None or not user.active:
        return None
    if user.restaurant_id is not None and not db.get(Restaurant, user.restaurant_id).active:
        return None
    return user


def _slug_di(db: Session, user: AppUser) -> str | None:
    if user.restaurant_id is None:
        return None
    return db.get(Restaurant, user.restaurant_id).slug


@router.post("/login")
def login(data: LoginRequest, request: Request, db: DbSession) -> TokenResponse:
    # Si contano solo i tentativi falliti, per IP e per username: chi accede correttamente
    # non viene mai fermato (nemmeno da un IP condiviso). Esaurito il limite, anche la
    # password giusta aspetta, altrimenti il limite non fermerebbe chi sta indovinando.
    ip = ratelimit.ip_client(request.headers, request.client and request.client.host)
    slug = data.restaurant.strip().lower() if data.restaurant else None
    # Il limite per utente conta solo lo username (non lo slug): niente doppio budget di tentativi.
    nome = hashlib.sha256(data.username.strip().lower().encode()).hexdigest()[:32]
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
    return TokenResponse(
        access_token=create_access_token(user),
        role=user.role,
        must_change_password=user.must_change_password,
        restaurant_slug=_slug_di(db, user),
    )


@router.get("/me")
def me(user: CurrentUser, db: DbSession) -> UserOut:
    out = UserOut.model_validate(user)
    out.restaurant_slug = _slug_di(db, user)
    return out


@router.post("/change-password")
def cambia_password(data: ChangePasswordIn, user: CurrentUser, db: DbSession) -> TokenResponse:
    """Cambio della propria password (chiede quella attuale). Toglie l'obbligo di cambiarla.

    I token emessi prima non valgono più: si risponde con un token nuovo per questa sessione."""
    chiave = f"change-pw:{user.id}"
    ratelimit.verifica(chiave, settings.rate_limit_login_user_max, settings.rate_limit_login_window)
    if not verify_password(data.current_password, user.password_hash):
        ratelimit.colpisci(
            chiave, settings.rate_limit_login_user_max, settings.rate_limit_login_window
        )
        raise HTTPException(status.HTTP_403_FORBIDDEN, "La password attuale non è corretta")
    if data.new_password == data.current_password:
        raise Invalid("La nuova password dev'essere diversa da quella attuale")
    user.password_hash = hash_password(data.new_password)
    user.must_change_password = False
    user.password_changed_at = datetime.now(UTC)
    db.commit()
    return TokenResponse(
        access_token=create_access_token(user),
        role=user.role,
        must_change_password=False,
        restaurant_slug=_slug_di(db, user),
    )
