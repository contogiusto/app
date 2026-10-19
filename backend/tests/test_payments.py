from decimal import Decimal

import pytest

from app.models import (
    MenuItem,
    OrderItem,
    Restaurant,
    RestaurantTable,
    SessionStatus,
    TableSession,
    UserRole,
)


@pytest.fixture
def ristorante(db):
    r = Restaurant(name="Trattoria Test")
    db.add(r)
    db.flush()
    return r


@pytest.fixture
def waiter(auth_header):
    return auth_header(UserRole.WAITER)


@pytest.fixture
def nuova_sessione(db, ristorante):
    contatore = {"n": 0}

    def _crea(coperti=3):
        contatore["n"] += 1
        t = RestaurantTable(
            restaurant_id=ristorante.id, number=contatore["n"], qr_token=f"tok{contatore['n']}"
        )
        db.add(t)
        db.flush()
        s = TableSession(table_id=t.id, coperti=coperti)
        db.add(s)
        db.flush()
        return s

    return _crea


@pytest.fixture
def sessione(nuova_sessione):
    return nuova_sessione(3)


@pytest.fixture
def piatto(db, ristorante):
    m = MenuItem(restaurant_id=ristorante.id, name="Piatto", category="X", price=Decimal("10.00"))
    db.add(m)
    db.flush()
    return m


def _ordina(db, sessione, piatto, quantita=1, prezzo="10.00"):
    item = OrderItem(
        session_id=sessione.id,
        menu_item_id=piatto.id,
        quantity=quantita,
        unit_price=Decimal(prezzo),
    )
    db.add(item)
    db.flush()
    return item


def _modalita(client, sessione, modo, header):
    return client.put(
        f"/api/sessions/{sessione.id}/mode", json={"payment_mode": modo}, headers=header
    )


def _paga(client, sessione, header, metodo="ONLINE", nome="Mario", voci=None):
    corpo = {"method": metodo, "customer_nickname": nome}
    if voci is not None:
        corpo["items"] = voci
    return client.post(f"/api/sessions/{sessione.id}/payments", json=corpo, headers=header)


def _stato(client, sessione, header):
    return client.get(f"/api/sessions/{sessione.id}", headers=header).json()["status"]


# --- modalità del tavolo -------------------------------------------------------------------


def test_imposta_modalita(client, sessione, waiter):
    r = _modalita(client, sessione, "ROMANA", waiter)
    assert r.status_code == 200
    assert r.json()["payment_mode"] == "ROMANA"


def test_modalita_idempotente_vince_la_prima(client, sessione, waiter):
    _modalita(client, sessione, "ROMANA", waiter)
    r = _modalita(client, sessione, "OWN", waiter)
    assert r.status_code == 200
    assert r.json()["payment_mode"] == "ROMANA"


def test_modalita_richiede_staff_e_sessione_valida(client, db, sessione, waiter):
    assert (
        client.put(f"/api/sessions/{sessione.id}/mode", json={"payment_mode": "OWN"}).status_code
        == 401
    )
    assert _modalita(client, TableSession(id=999999), "OWN", waiter).status_code == 404
    sessione.status = SessionStatus.CLOSED
    db.flush()
    assert _modalita(client, sessione, "OWN", waiter).status_code == 409


def test_modalita_non_valida_422(client, sessione, waiter):
    assert _modalita(client, sessione, "ALTRO", waiter).status_code == 422


# --- alla romana ---------------------------------------------------------------------------


def test_pagamento_senza_modalita_409(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto)
    assert _paga(client, sessione, waiter).status_code == 409


def test_romana_senza_ordini_409(client, sessione, waiter):
    _modalita(client, sessione, "ROMANA", waiter)
    assert _paga(client, sessione, waiter).status_code == 409


def test_romana_divide_per_coperti_e_chiude(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto, 3)  # 30.00 su 3 coperti
    _modalita(client, sessione, "ROMANA", waiter)
    importi = []
    for nome in ("A", "B", "C"):
        assert _stato(client, sessione, waiter) == "OPEN"
        r = _paga(client, sessione, waiter, nome=nome)
        assert r.status_code == 201
        importi.append(r.json()["amount"])
    assert importi == ["10.00", "10.00", "10.00"]
    assert _stato(client, sessione, waiter) == "CLOSED"


def test_romana_il_resto_va_all_ultimo(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto, 1)  # 10.00 su 3 coperti
    _modalita(client, sessione, "ROMANA", waiter)
    importi = [_paga(client, sessione, waiter, nome=n).json()["amount"] for n in "ABC"]
    assert importi == ["3.33", "3.33", "3.34"]
    assert sum(Decimal(i) for i in importi) == Decimal("10.00")


def test_romana_dopo_la_chiusura_409(client, db, nuova_sessione, piatto, waiter):
    s = nuova_sessione(1)
    _ordina(db, s, piatto)
    _modalita(client, s, "ROMANA", waiter)
    assert _paga(client, s, waiter).status_code == 201
    assert _paga(client, s, waiter).status_code == 409


def test_romana_importo_troppo_basso_409(client, db, nuova_sessione, piatto, waiter):
    s = nuova_sessione(4)
    _ordina(db, s, piatto, 1, prezzo="0.03")  # 0.03 / 4 = 0.00
    _modalita(client, s, "ROMANA", waiter)
    assert _paga(client, s, waiter).status_code == 409


def test_metodo_online_completato_cassa_in_attesa(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto, 3)
    _modalita(client, sessione, "ROMANA", waiter)
    assert _paga(client, sessione, waiter, "ONLINE").json()["status"] == "COMPLETED"
    assert _paga(client, sessione, waiter, "CASH").json()["status"] == "CASH"


def test_pagamento_richiede_staff_e_nome(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto)
    _modalita(client, sessione, "ROMANA", waiter)
    r = client.post(
        f"/api/sessions/{sessione.id}/payments",
        json={"method": "CASH", "customer_nickname": "A"},
    )
    assert r.status_code == 401
    assert _paga(client, sessione, waiter, nome="").status_code == 422


# --- proprio conto -------------------------------------------------------------------------


def test_own_richiede_voci(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto)
    _modalita(client, sessione, "OWN", waiter)
    assert _paga(client, sessione, waiter).status_code == 422
    assert _paga(client, sessione, waiter, voci=[]).status_code == 422


def test_own_importo_somma_delle_voci(client, db, sessione, piatto, waiter):
    a = _ordina(db, sessione, piatto, 2, prezzo="10.00")
    b = _ordina(db, sessione, piatto, 1, prezzo="4.50")
    _ordina(db, sessione, piatto, 1)  # resta da pagare a qualcun altro
    _modalita(client, sessione, "OWN", waiter)
    voci = [{"order_item_id": a.id, "quantity": 1}, {"order_item_id": b.id, "quantity": 1}]
    r = _paga(client, sessione, waiter, voci=voci)
    assert r.status_code == 201
    assert r.json()["amount"] == "14.50"
    assert _stato(client, sessione, waiter) == "OPEN"


def test_own_quantita_parziale_e_residuo(client, db, sessione, piatto, waiter):
    item = _ordina(db, sessione, piatto, 2)
    _modalita(client, sessione, "OWN", waiter)
    uno = [{"order_item_id": item.id, "quantity": 1}]
    assert _paga(client, sessione, waiter, voci=uno).status_code == 201
    assert _paga(client, sessione, waiter, voci=uno, nome="B").status_code == 201
    assert _paga(client, sessione, waiter, voci=uno, nome="C").status_code in (404, 409)


def test_own_quantita_oltre_il_residuo_409(client, db, sessione, piatto, waiter):
    item = _ordina(db, sessione, piatto, 1)
    _modalita(client, sessione, "OWN", waiter)
    voci = [{"order_item_id": item.id, "quantity": 2}]
    assert _paga(client, sessione, waiter, voci=voci).status_code == 409


def test_own_chiude_quando_tutto_e_coperto(client, db, sessione, piatto, waiter):
    a = _ordina(db, sessione, piatto, 1)
    b = _ordina(db, sessione, piatto, 1)
    _modalita(client, sessione, "OWN", waiter)
    _paga(client, sessione, waiter, voci=[{"order_item_id": a.id, "quantity": 1}])
    assert _stato(client, sessione, waiter) == "OPEN"
    _paga(client, sessione, waiter, "CASH", "B", [{"order_item_id": b.id, "quantity": 1}])
    assert _stato(client, sessione, waiter) == "CLOSED"


def test_own_voce_di_un_altra_sessione_404(client, db, sessione, nuova_sessione, piatto, waiter):
    altra = nuova_sessione(2)
    estranea = _ordina(db, altra, piatto)
    _ordina(db, sessione, piatto)
    _modalita(client, sessione, "OWN", waiter)
    voci = [{"order_item_id": estranea.id, "quantity": 1}]
    assert _paga(client, sessione, waiter, voci=voci).status_code == 404


def test_own_quantita_non_valida_422(client, db, sessione, piatto, waiter):
    item = _ordina(db, sessione, piatto)
    _modalita(client, sessione, "OWN", waiter)
    voci = [{"order_item_id": item.id, "quantity": 0}]
    assert _paga(client, sessione, waiter, voci=voci).status_code == 422


# --- elenco, conferma contanti, chiusura forzata -------------------------------------------


def test_elenco_pagamenti_con_incassato_e_residuo(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto, 3)
    _modalita(client, sessione, "ROMANA", waiter)
    _paga(client, sessione, waiter)
    body = client.get(f"/api/sessions/{sessione.id}/payments", headers=waiter).json()
    assert len(body["items"]) == 1
    assert body["paid_total"] == "10.00"
    assert body["remaining"] == "20.00"
    assert client.get(f"/api/sessions/{sessione.id}/payments").status_code == 401


def test_conferma_contanti(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto, 3)
    _modalita(client, sessione, "ROMANA", waiter)
    pagamento = _paga(client, sessione, waiter, "CASH").json()
    r = client.put(f"/api/payments/{pagamento['id']}/confirm", headers=waiter)
    assert r.status_code == 200
    assert r.json()["status"] == "COMPLETED"


def test_conferma_solo_pagamenti_in_attesa_cassa(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto, 3)
    _modalita(client, sessione, "ROMANA", waiter)
    online = _paga(client, sessione, waiter, "ONLINE").json()
    assert client.put(f"/api/payments/{online['id']}/confirm", headers=waiter).status_code == 409
    assert client.put("/api/payments/999999/confirm", headers=waiter).status_code == 404
    assert client.put(f"/api/payments/{online['id']}/confirm").status_code == 401


def test_chiusura_forzata(client, db, sessione, piatto, waiter):
    _ordina(db, sessione, piatto)
    r = client.post(f"/api/sessions/{sessione.id}/close", headers=waiter)
    assert r.status_code == 200
    assert r.json()["status"] == "CLOSED"
    db.refresh(sessione)
    assert sessione.closed_at is not None
    assert client.post(f"/api/sessions/{sessione.id}/close", headers=waiter).status_code == 409


def test_chiusura_forzata_richiede_staff_e_sessione(client, sessione, waiter):
    assert client.post(f"/api/sessions/{sessione.id}/close").status_code == 401
    assert client.post("/api/sessions/999999/close", headers=waiter).status_code == 404
