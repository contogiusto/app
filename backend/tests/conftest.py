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


@pytest.fixture(autouse=True)
def _contatori_rate_limit_puliti(engine):
    """I contatori del rate limit sono committati (connessione propria): vanno azzerati."""
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE rate_limit_counter"))


@pytest.fixture
def db(engine):
    """Sessione isolata: tutto ciò che il test scrive viene annullato a fine test."""
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        yield session
        session.close()
        transaction.rollback()


@pytest.fixture
def client(db):
    """TestClient che usa la sessione di test (annullata a fine test)."""
    from fastapi.testclient import TestClient

    from app.db import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(db):
    from app.models import AppUser
    from app.security import hash_password

    def _make(username: str, role, password: str = "pw-di-test"):
        user = AppUser(username=username, password_hash=hash_password(password), role=role)
        db.add(user)
        db.flush()
        return user

    return _make


@pytest.fixture
def auth_header(make_user):
    """Header Authorization per un utente con il ruolo richiesto."""
    from app.security import create_access_token

    def _header(role) -> dict[str, str]:
        user = make_user(f"user-{role.value.lower()}", role)
        return {"Authorization": f"Bearer {create_access_token(user)}"}

    return _header


@pytest.fixture
def make_customer(db):
    from app.models import Customer
    from app.security import hash_password

    def _make(email="anna@example.com", password="una-password-buona", **kw):
        customer = Customer(
            email=email,
            password_hash=hash_password(password),
            first_name=kw.pop("first_name", "Anna"),
            last_name=kw.pop("last_name", "Russo"),
            **kw,
        )
        db.add(customer)
        db.flush()
        return customer

    return _make


@pytest.fixture
def customer_header(make_customer):
    """Header Authorization di un cliente registrato (restituisce anche il cliente)."""
    from app.security import create_customer_token

    def _header(**kw):
        customer = make_customer(**kw)
        return {"Authorization": f"Bearer {create_customer_token(customer)}"}, customer

    return _header
