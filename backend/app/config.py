import os

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://contogiusto:contogiusto@localhost:5433/contogiusto"
    jwt_secret: str = "change-me"
    frontend_url: str = "http://localhost:5173"

    # Rate limit (vedi app/ratelimit.py). Le finestre sono in secondi.
    rate_limit_enabled: bool = True
    # Gli header dell'IP del client (x-real-ip, x-forwarded-for) si leggono solo dietro il proxy
    # di Vercel, che li riscrive: altrove chiunque potrebbe falsificarli per aggirare il limite.
    trust_proxy_headers: bool = Field(default_factory=lambda: bool(os.environ.get("VERCEL")))
    # Login: solo i tentativi falliti, per IP e per username.
    rate_limit_login_ip_max: int = 20
    rate_limit_login_user_max: int = 5
    rate_limit_login_window: int = 900
    # Endpoint pubblici: accessi con token errato per IP...
    rate_limit_public_fail_max: int = 20
    rate_limit_public_fail_window: int = 600
    # ...tutte le richieste valide per tavolo (polling incluso)...
    rate_limit_public_table_max: int = 600
    rate_limit_public_table_window: int = 60
    # ...e le scritture (modalità, pagamenti) per tavolo.
    rate_limit_public_write_max: int = 30
    rate_limit_public_write_window: int = 600

    @field_validator("database_url")
    @classmethod
    def _usa_driver_psycopg(cls, url: str) -> str:
        # Neon/Vercel forniscono postgres:// o postgresql://: SQLAlchemy vuole il driver esplicito.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url


settings = Settings()
