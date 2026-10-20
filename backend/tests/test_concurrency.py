"""Richieste parallele vere: connessioni separate e dati committati, non la sessione di test.

A fine test le tabelle vengono svuotate: gli altri test contano le righe e non devono vedere
nulla di questi.
"""

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.main import app
from app.models import (
    MenuItem,
    OrderItem,
    Restaurant,
    RestaurantTable,
    SessionStatus,
    TableSession,
)

TOKEN = "token-concorrenza"
H = {"X-Table-Token": TOKEN}
TABELLE = (
    "payment_item, payment, order_item, table_session, restaurant_table, menu_item, restaurant, "
    "rate_limit_counter"
)


@pytest.fixture
def dati_committati(engine):
    def _svuota():
        with engine.begin() as conn:
            conn.execute(text(f"TRUNCATE {TABELLE} RESTART IDENTITY CASCADE"))

    _svuota()

    def _crea(coperti: int, quantita: int, prezzo: str = "10.00"):
        with SessionLocal() as db:
            r = Restaurant(name="Concorrenza")
            db.add(r)
            db.flush()
            tavolo = RestaurantTable(restaurant_id=r.id, number=1, qr_token=TOKEN)
            piatto = MenuItem(restaurant_id=r.id, name="Pizza", category="X", price=Decimal(prezzo))
            db.add_all([tavolo, piatto])
            db.flush()
            sessione = TableSession(table_id=tavolo.id, coperti=coperti)
            db.add(sessione)
            db.flush()
            riga = OrderItem(
                session_id=sessione.id,
                menu_item_id=piatto.id,
                quantity=quantita,
                unit_price=piatto.price,
            )
            db.add(riga)
            db.commit()
            return tavolo.id, sessione.id, riga.id

    yield _crea
    _svuota()


def _in_parallelo(n, funzione):
    with ThreadPoolExecutor(max_workers=n) as pool:
        return [f.result() for f in [pool.submit(funzione, i) for i in range(n)]]


def _paga(tavolo_id, corpo):
    # Un client per thread, come farebbero utenti diversi.
    with TestClient(app) as client:
        return client.post(f"/api/public/tables/{tavolo_id}/payments", json=corpo, headers=H)


def test_alla_romana_non_si_superano_i_coperti(dati_committati):
    tavolo_id, sessione_id, _ = dati_committati(coperti=2, quantita=1, prezzo="10.01")
    with TestClient(app) as client:
        client.put(
            f"/api/public/tables/{tavolo_id}/mode", json={"payment_mode": "ROMANA"}, headers=H
        )

    risposte = _in_parallelo(
        6, lambda i: _paga(tavolo_id, {"method": "ONLINE", "customer_nickname": f"P{i}"})
    )

    esiti = sorted(r.status_code for r in risposte)
    assert esiti == [201, 201, 409, 409, 409, 409]
    importi = [Decimal(r.json()["amount"]) for r in risposte if r.status_code == 201]
    assert sum(importi) == Decimal("10.01")  # il resto dell'arrotondamento è stato assegnato
    with SessionLocal() as db:
        assert db.get(TableSession, sessione_id).status == SessionStatus.CLOSED


def test_proprio_conto_la_stessa_voce_si_paga_una_volta_sola(dati_committati):
    tavolo_id, _, riga_id = dati_committati(coperti=4, quantita=1)
    with TestClient(app) as client:
        client.put(f"/api/public/tables/{tavolo_id}/mode", json={"payment_mode": "OWN"}, headers=H)

    corpo = {
        "method": "ONLINE",
        "customer_nickname": "Gara",
        "items": [{"order_item_id": riga_id, "quantity": 1}],
    }
    risposte = _in_parallelo(5, lambda _i: _paga(tavolo_id, corpo))

    assert sorted(r.status_code for r in risposte).count(201) == 1
    assert all(r.status_code in (201, 409) for r in risposte)


def test_rate_limit_richieste_parallele_non_superano_il_limite(engine):
    from app import ratelimit
    from app.errors import TooManyRequests

    def _colpo(_i):
        try:
            ratelimit.colpisci("concorrenza", limite=5, finestra=3600)
            return "ok"
        except TooManyRequests:
            return "429"

    try:
        esiti = _in_parallelo(20, _colpo)
        assert esiti.count("ok") == 5
        assert esiti.count("429") == 15
    finally:
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE rate_limit_counter"))


def test_login_sbagliato_parallelo_non_supera_il_limite(engine, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "rate_limit_login_user_max", 3)
    monkeypatch.setattr(settings, "rate_limit_login_ip_max", 1000)

    def _login(_i):
        with TestClient(app) as client:
            return client.post(
                "/api/auth/login", json={"username": "ignoto", "password": "x"}
            ).status_code

    try:
        esiti = _in_parallelo(12, _login)
        # Solo tre tentativi ottengono 401 (e quindi una verifica della password): gli altri 429.
        assert esiti.count(401) == 3
        assert esiti.count(429) == 9
    finally:
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE rate_limit_counter"))
