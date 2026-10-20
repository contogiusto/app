"""Hash delle password e token JWT di staff e clienti."""

import os
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import settings
from app.models import AppUser, Customer

ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(hours=24)
# I clienti restano collegati sul loro telefono molto più a lungo dello staff.
CUSTOMER_TOKEN_LIFETIME = timedelta(days=30)
# Tipo del token: un token cliente non deve mai valere come token staff, e viceversa
# (id numerici uguali in tabelle diverse altrimenti si scambierebbero).
STAFF = "staff"
CUSTOMER = "customer"
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
        "typ": STAFF,
        "role": user.role.value,
        "exp": datetime.now(UTC) + expires_in,
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def create_customer_token(
    customer: Customer, expires_in: timedelta = CUSTOMER_TOKEN_LIFETIME
) -> str:
    payload = {
        "sub": str(customer.id),
        "typ": CUSTOMER,
        "exp": datetime.now(UTC) + expires_in,
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Solleva jwt.PyJWTError se il token è scaduto, manomesso o malformato."""
    return jwt.decode(token, _secret(), algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})


def token_type(payload: dict) -> str:
    """Staff o cliente. I token staff emessi prima di questa distinzione non hanno `typ`:
    restano validi come staff (scadono comunque entro 24 ore)."""
    return payload.get("typ", STAFF)
