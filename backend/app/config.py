from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://contogiusto:contogiusto@localhost:5432/contogiusto"
    jwt_secret: str = "change-me"
    frontend_url: str = "http://localhost:5173"


settings = Settings()
