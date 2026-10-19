"""Hash delle password e token JWT dello staff."""

import os
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import settings
from app.models import AppUser

ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(hours=24)
_DEFAULT_SECRET = "change-me"

_hasher = PasswordHash.recommended()
# Hash di una password casuale: serve a rendere uguale il tempo di risposta del login
# quando l'utente non esiste, così non si può scoprire quali username sono validi.
_DUMMY_HASH = _hasher.hash("password-fittizia")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    return _hasher.verify(password, password_hash or _DUMMY_HASH) and password_hash is not None


def _secret() -> str:
    # Si controlla qui e non all'avvio: un JWT_SECRET mancante in produzione non deve
    # buttare giù tutta l'API (es. /api/health), solo bloccare login e token.
    if settings.jwt_secret == _DEFAULT_SECRET and os.environ.get("VERCEL_ENV") == "production":
        raise RuntimeError("JWT_SECRET non configurato in produzione")
    return settings.jwt_secret


def create_access_token(user: AppUser, expires_in: timedelta = TOKEN_LIFETIME) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "exp": datetime.now(UTC) + expires_in,
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Solleva jwt.PyJWTError se il token è scaduto, manomesso o malformato."""
    return jwt.decode(token, _secret(), algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
