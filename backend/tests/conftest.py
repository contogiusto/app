import os

# Deve avvenire prima di importare app.*: la config legge DATABASE_URL all'import.
TEST_DB = "contogiusto_test"
BASE_URL = os.environ.get(
    "TEST_DATABASE_SERVER", "postgresql+psycopg://contogiusto:contogiusto@localhost:5433"
)
os.environ["DATABASE_URL"] = f"{BASE_URL}/{TEST_DB}"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402


@pytest.fixture(scope="session")
def engine():
    admin = create_engine(f"{BASE_URL}/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {TEST_DB}"))
    admin.dispose()

    # Lo schema di test nasce dalle migration: così le verifichiamo insieme ai modelli.
    command.upgrade(Config("alembic.ini"), "head")

    from app.db import engine as app_engine

    yield app_engine
    app_engine.dispose()


@pytest.fixture
def db(engine):
    """Sessione isolata: tutto ciò che il test scrive viene annullato a fine test."""
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        yield session
        session.close()
        transaction.rollback()
