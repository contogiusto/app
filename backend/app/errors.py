"""Errori di dominio: la logica li solleva, l'API li traduce in risposte HTTP."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    status_code = 409


class Invalid(DomainError):
    status_code = 422


class TooManyRequests(DomainError):
    status_code = 429

    def __init__(self, retry_after: int):
        super().__init__("Troppe richieste: riprova tra qualche istante")
        self.retry_after = retry_after


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain_error(_request: Request, exc: DomainError) -> JSONResponse:
        headers = (
            {"Retry-After": str(exc.retry_after)} if isinstance(exc, TooManyRequests) else None
        )
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.detail}, headers=headers
        )
