"""Invio delle email (solo testo) tramite Resend.

Servono `RESEND_API_KEY` ed `EMAIL_FROM` (un mittente di un dominio verificato su Resend).
Senza, nulla parte e il messaggio compare nel log: così in sviluppo e nei test il link di
recupero password si legge senza servizi esterni. Un errore di invio non fa mai cadere la
richiesta che lo ha causato (la risposta non deve dire se l'email esiste o no).
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"
TIMEOUT_SECONDS = 10


def send_email(to: str, subject: str, text: str) -> None:
    if not settings.resend_api_key or not settings.email_from:
        if settings.email_log_links:  # sviluppo: il link si legge qui
            logger.info(
                "Email non inviata (Resend non configurato) a %s: %s\n%s", to, subject, text
            )
        else:  # produzione: il testo ha un link segreto, nessun dato nel log
            logger.error("Email non inviata: Resend non configurato (RESEND_API_KEY/EMAIL_FROM)")
        return
    try:
        response = httpx.post(
            RESEND_URL,
            json={"from": settings.email_from, "to": [to], "subject": subject, "text": text},
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        # Solo il tipo di errore e lo stato: mai gli header (c'è la chiave) né il corpo.
        stato = getattr(getattr(exc, "response", None), "status_code", None)
        logger.error("Invio email non riuscito (%s, stato %s)", type(exc).__name__, stato)
