from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://contogiusto:contogiusto@localhost:5432/contogiusto"
    jwt_secret: str = "change-me"
    frontend_url: str = "http://localhost:5173"

    @field_validator("database_url")
    @classmethod
    def _usa_driver_psycopg(cls, url: str) -> str:
        # Neon/Vercel forniscono postgres:// o postgresql://: SQLAlchemy vuole il driver esplicito.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url


settings = Settings()
