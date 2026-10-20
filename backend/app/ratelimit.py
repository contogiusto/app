"""Rate limit con contatori su tabella (finestra fissa), adatto al serverless.

Su Vercel ogni istanza ha la sua memoria: un contatore in RAM non limiterebbe nulla. Il
contatore sta quindi nel database, una riga per (chiave, finestra), aggiornata in modo atomico
con `INSERT … ON CONFLICT DO UPDATE … RETURNING`: richieste concorrenti vedono valori distinti
e consecutivi, quindi non possono superare il limite.

Il contatore usa una connessione propria e fa commit subito: deve restare anche quando la
richiesta poi fallisce (un login errato annulla la transazione dell'endpoint, non il tentativo).

Limite della finestra fissa: a cavallo di due finestre si possono fare fino a 2× il limite in
pochi secondi. Per la protezione da tentativi ripetuti basta; i limiti sono comunque larghi.
"""

import ipaddress
import logging
import random
import time
from collections.abc import Mapping
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError

from app import db as database
from app.config import settings
from app.errors import TooManyRequests
from app.models import RateLimitCounter

logger = logging.getLogger(__name__)

# Le righe scadute si cancellano ogni tanto durante le richieste, senza job separati.
PROBABILITA_PULIZIA = 0.02


def _adesso() -> float:
    return time.time()


def _finestra(finestra: int) -> tuple[datetime, datetime, int]:
    """(inizio, fine, secondi alla fine) della finestra corrente."""
    ora = _adesso()
    inizio = ora - (ora % finestra)
    fine = inizio + finestra
    return (
        datetime.fromtimestamp(inizio, UTC),
        datetime.fromtimestamp(fine, UTC),
        max(1, int(fine - ora + 0.999)),
    )


def colpisci(chiave: str, limite: int, finestra: int) -> None:
    """Conta una richiesta; oltre `limite` nella finestra solleva TooManyRequests (429)."""
    if not settings.rate_limit_enabled:
        return
    inizio, fine, attesa = _finestra(finestra)
    stmt = (
        insert(RateLimitCounter)
        .values(key=chiave, window_start=inizio, expires_at=fine, count=1)
        .on_conflict_do_update(
            index_elements=["key", "window_start"],
            set_={"count": RateLimitCounter.count + 1},
        )
        .returning(RateLimitCounter.count)
    )
    try:
        with database.engine.begin() as conn:
            conteggio = conn.execute(stmt).scalar_one()
    except SQLAlchemyError:
        # Se il contatore non funziona (es. migration non ancora applicata) meglio non
        # fermare i pagamenti: si lascia passare e si segnala nei log.
        logger.exception("rate limit non disponibile: richiesta lasciata passare")
        return
    if random.random() < PROBABILITA_PULIZIA:
        pulisci()
    if conteggio > limite:
        raise TooManyRequests(attesa)


def verifica(chiave: str, limite: int, finestra: int) -> None:
    """Solleva TooManyRequests se il limite è già esaurito, senza contare nulla."""
    if not settings.rate_limit_enabled:
        return
    inizio, _fine, attesa = _finestra(finestra)
    try:
        with database.engine.connect() as conn:
            conteggio = conn.execute(
                select(RateLimitCounter.count).where(
                    RateLimitCounter.key == chiave, RateLimitCounter.window_start == inizio
                )
            ).scalar()
    except SQLAlchemyError:
        logger.exception("rate limit non disponibile: richiesta lasciata passare")
        return
    if conteggio is not None and conteggio >= limite:
        raise TooManyRequests(attesa)


def pulisci() -> None:
    """Elimina i contatori di finestre ormai scadute."""
    adesso = datetime.fromtimestamp(_adesso(), UTC)
    try:
        with database.engine.begin() as conn:
            conn.execute(delete(RateLimitCounter).where(RateLimitCounter.expires_at <= adesso))
    except SQLAlchemyError:
        logger.exception("pulizia dei contatori del rate limit non riuscita")


def ip_client(headers: Mapping[str, str], host: str | None) -> str:
    """Indirizzo IP del client, da usare come chiave.

    Dietro Vercel il proxy riscrive `x-real-ip` e `x-forwarded-for`, quindi ci si può fidare
    (di quello che aggiunge il proxy: in `x-forwarded-for` l'ultimo valore, non il primo, che
    potrebbe arrivare dal client). Fuori da Vercel (`trust_proxy_headers` spento) gli header
    si ignorano e vale l'indirizzo della connessione. Gli IPv6 si raggruppano per /64: chi
    ne controlla una intera cambia indirizzo a piacere.
    """
    ip = host or "sconosciuto"
    if settings.trust_proxy_headers:
        reale = headers.get("x-real-ip")
        inoltrati = headers.get("x-forwarded-for")
        if reale:
            ip = reale.strip()
        elif inoltrati:
            ip = inoltrati.split(",")[-1].strip()
    try:
        indirizzo = ipaddress.ip_address(ip)
    except ValueError:
        return ip[:64]
    if indirizzo.version == 6:
        return str(ipaddress.ip_network((indirizzo, 64), strict=False).network_address) + "/64"
    return str(indirizzo)
