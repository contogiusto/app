import pytest

from app.config import Settings


@pytest.mark.parametrize(
    "raw",
    [
        "postgres://u:p@host/db?sslmode=require",
        "postgresql://u:p@host/db?sslmode=require",
        "postgresql+psycopg://u:p@host/db?sslmode=require",
    ],
)
def test_database_url_usa_driver_psycopg(raw):
    assert Settings(database_url=raw).database_url == (
        "postgresql+psycopg://u:p@host/db?sslmode=require"
    )
