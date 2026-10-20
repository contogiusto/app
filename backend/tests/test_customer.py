from datetime import timedelta
from decimal import Decimal

import jwt
import pytest

from app.config import settings
from app.models import (
    Customer,
    MenuItem,
    OrderItem,
    Payment,
    PaymentItem,
    PaymentMethod,
    PaymentMode,
    PaymentStatus,
    Restaurant,
    RestaurantTable,
    TableSession,
    UserRole,
)
from app.security import create_customer_token

NUOVO = {
    "email": "Anna.Russo@Example.com",
    "password": "una-password-buona",
    "first_name": "Anna",
    "last_name": "Russo",
    "city": "Milano",
    "accept_privacy": True,
}


def _registra(client, **over):
    return client.post("/api/customer/auth/register", json={**NUOVO, **over})


# --- registrazione -------------------------------------------------------------------------


def test_registrazione_crea_account_e_restituisce_token(client, db):
    r = _registra(client)
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["customer"]["email"] == "anna.russo@example.com"
    assert body["customer"]["first_name"] == "Anna"
    payload = jwt.decode(body["access_token"], settings.jwt_secret, algorithms=["HS256"])
    assert payload["typ"] == "customer"
    saved = db.query(Customer).one()
    assert saved.password_hash != NUOVO["password"]
    assert saved.privacy_accepted_at is not None


def test_email_gia_registrata_anche_con_maiuscole_diverse_409(client):
    assert _registra(client).status_code == 201
    r = _registra(client, email="ANNA.RUSSO@example.com")
    assert r.status_code == 409
    assert r.json()["detail"] == "Email già registrata"


@pytest.mark.parametrize(
    "campo,valore",
    [
        ("email", "non-una-email"),
        ("password", "corta"),
        ("password", "x" * 200),
        ("first_name", ""),
        ("last_name", "   "),
        ("accept_privacy", False),
    ],
)
def test_registrazione_valida_i_dati(client, campo, valore):
    assert _registra(client, **{campo: valore}).status_code == 422


def test_la_citta_e_facoltativa(client, db):
    r = client.post(
        "/api/customer/auth/register",
        json={k: v for k, v in NUOVO.items() if k != "city"},
    )
    assert r.status_code == 201
    assert db.query(Customer).one().city is None


def test_registrazioni_ripetute_dallo_stesso_ip_danno_429(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_register_max", 2)
    assert _registra(client, email="a@example.com").status_code == 201
    assert _registra(client, email="b@example.com").status_code == 201
    r = _registra(client, email="c@example.com")
    assert r.status_code == 429
    assert "Retry-After" in r.headers


# --- login ---------------------------------------------------------------------------------


def test_login_corretto_senza_badare_alle_maiuscole(client, make_customer):
    make_customer("anna@example.com", "una-password-buona")
    r = client.post(
        "/api/customer/auth/login",
        json={"email": "ANNA@Example.com", "password": "una-password-buona"},
    )
    assert r.status_code == 200
    assert r.json()["customer"]["email"] == "anna@example.com"


@pytest.mark.parametrize(
    "email,password",
    [("anna@example.com", "sbagliata"), ("nessuna@example.com", "una-password-buona")],
)
def test_login_rifiutato_con_lo_stesso_errore(client, make_customer, email, password):
    make_customer("anna@example.com", "una-password-buona")
    r = client.post("/api/customer/auth/login", json={"email": email, "password": password})
    assert r.status_code == 401
    assert r.json()["detail"] == "Credenziali non valide"


def test_login_sbagliato_ripetuto_blocca_anche_la_password_giusta(
    client, make_customer, monkeypatch
):
    monkeypatch.setattr(settings, "rate_limit_login_user_max", 3)
    make_customer("anna@example.com", "una-password-buona")
    for _ in range(3):
        r = client.post(
            "/api/customer/auth/login", json={"email": "anna@example.com", "password": "no"}
        )
        assert r.status_code == 401
    r = client.post(
        "/api/customer/auth/login",
        json={"email": "anna@example.com", "password": "una-password-buona"},
    )
    assert r.status_code == 429


# --- i token di staff e clienti non si scambiano --------------------------------------------


def test_un_token_cliente_non_vale_come_staff(client, make_user, make_customer):
    # Id numerici uguali di proposito: a distinguerli deve bastare il tipo del token.
    staff = make_user("admin", UserRole.ADMIN)
    cliente = make_customer()
    cliente.id = staff.id
    header = {"Authorization": f"Bearer {create_customer_token(cliente)}"}
    assert client.get("/api/tables", headers=header).status_code == 401
    assert client.get("/api/auth/me", headers=header).status_code == 401


def test_un_token_staff_non_vale_come_cliente(client, auth_header):
    assert client.get("/api/customer/me", headers=auth_header(UserRole.ADMIN)).status_code == 401


def test_i_vecchi_token_staff_senza_tipo_continuano_a_valere(client, make_user):
    user = make_user("vecchio", UserRole.WAITER)
    token = jwt.encode(
        {"sub": str(user.id), "role": "WAITER", "exp": 9999999999},
        settings.jwt_secret,
        algorithm="HS256",
    )
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_token_cliente_scaduto_401(client, make_customer):
    cliente = make_customer()
    token = create_customer_token(cliente, expires_in=timedelta(seconds=-1))
    r = client.get("/api/customer/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


# --- profilo ---------------------------------------------------------------------------------


def test_me_senza_token_401(client):
    assert client.get("/api/customer/me").status_code == 401


def test_leggi_e_modifica_il_profilo(client, customer_header):
    header, _ = customer_header(city="Roma")
    me = client.get("/api/customer/me", headers=header).json()
    assert (me["first_name"], me["last_name"], me["city"]) == ("Anna", "Russo", "Roma")
    assert "password" not in str(me)

    r = client.put(
        "/api/customer/me",
        json={"first_name": "  Anna Maria ", "last_name": "Russo", "city": ""},
        headers=header,
    )
    assert r.status_code == 200
    assert r.json()["first_name"] == "Anna Maria"
    assert r.json()["city"] is None


def test_modifica_profilo_valida_i_dati(client, customer_header):
    header, _ = customer_header()
    r = client.put(
        "/api/customer/me", json={"first_name": "", "last_name": "Russo"}, headers=header
    )
    assert r.status_code == 422


def test_elimina_account_richiede_la_password_giusta(client, db, customer_header):
    header, cliente = customer_header(password="una-password-buona")
    r = client.request("DELETE", "/api/customer/me", json={"password": "sbagliata"}, headers=header)
    assert r.status_code == 403
    assert db.get(Customer, cliente.id) is not None


def test_elimina_account_cancella_i_dati_e_rende_anonimi_i_pagamenti(client, db, customer_header):
    header, cliente = customer_header(password="una-password-buona")
    sessione = _sessione(db)
    pagamento = _pagamento(db, sessione, cliente)
    r = client.request(
        "DELETE", "/api/customer/me", json={"password": "una-password-buona"}, headers=header
    )
    assert r.status_code == 204
    assert db.get(Customer, cliente.id) is None
    db.refresh(pagamento)
    # Il pagamento resta (serve al ristorante) ma non è più legato a nessuna persona...
    assert pagamento.customer_id is None
    # ...e nemmeno il suo nome (digitato al tavolo, di solito nome e cognome) resta sul conto.
    assert pagamento.customer_nickname == "Cliente eliminato"
    assert client.get("/api/customer/me", headers=header).status_code == 401


def test_elimina_account_non_tocca_i_pagamenti_degli_altri(client, db, customer_header):
    header, anna = customer_header(email="anna@example.com", password="una-password-buona")
    luca = Customer(
        email="luca@example.com", password_hash="x", first_name="Luca", last_name="Bianchi"
    )
    db.add(luca)
    db.flush()
    sessione = _sessione(db)
    di_anna = _pagamento(db, sessione, anna)
    di_luca = _pagamento(db, sessione, luca)
    di_ospite = _pagamento(db, sessione, None)
    for p, nome in ((di_luca, "Luca Bianchi"), (di_ospite, "Marco Verdi")):
        p.customer_nickname = nome
    db.flush()

    r = client.request(
        "DELETE", "/api/customer/me", json={"password": "una-password-buona"}, headers=header
    )
    assert r.status_code == 204
    db.refresh(di_anna)
    db.refresh(di_luca)
    db.refresh(di_ospite)
    assert di_anna.customer_nickname == "Cliente eliminato"
    assert (di_luca.customer_nickname, di_luca.customer_id) == ("Luca Bianchi", luca.id)
    assert (di_ospite.customer_nickname, di_ospite.customer_id) == ("Marco Verdi", None)


# --- storico dei pagamenti -------------------------------------------------------------------


def _sessione(db, numero=5, coperti=2):
    r = Restaurant(name="Trattoria Test")
    db.add(r)
    db.flush()
    t = RestaurantTable(restaurant_id=r.id, number=numero, qr_token=f"tok-{numero}")
    db.add(t)
    db.flush()
    s = TableSession(table_id=t.id, coperti=coperti)
    db.add(s)
    db.flush()
    return s


def _piatto(db, sessione, nome="Pizza", categoria="Pizze", prezzo="8.50", quantita=2):
    m = MenuItem(
        restaurant_id=sessione.table.restaurant_id,
        name=nome,
        category=categoria,
        price=Decimal(prezzo),
    )
    db.add(m)
    db.flush()
    riga = OrderItem(
        session_id=sessione.id, menu_item_id=m.id, quantity=quantita, unit_price=Decimal(prezzo)
    )
    db.add(riga)
    db.flush()
    return riga


def _pagamento(db, sessione, cliente, modo=PaymentMode.ROMANA, importo="8.50", righe=None):
    p = Payment(
        session_id=sessione.id,
        customer_id=cliente.id if cliente else None,
        amount=Decimal(importo),
        mode=modo,
        method=PaymentMethod.ONLINE,
        status=PaymentStatus.COMPLETED,
        customer_nickname="Anna Russo",
    )
    db.add(p)
    db.flush()
    for riga, quantita in righe or []:
        db.add(PaymentItem(payment_id=p.id, order_item_id=riga.id, quantity=quantita))
    db.flush()
    return p


def test_storico_senza_token_401(client):
    assert client.get("/api/customer/payments").status_code == 401


def test_storico_vuoto(client, customer_header):
    header, _ = customer_header()
    assert client.get("/api/customer/payments", headers=header).json() == []


def test_storico_mostra_solo_i_propri_pagamenti_dal_piu_recente(client, db, customer_header):
    header, anna = customer_header()
    luca = Customer(
        email="luca@example.com", password_hash="x", first_name="Luca", last_name="Bianchi"
    )
    db.add(luca)
    db.flush()
    s1 = _sessione(db, numero=1)
    s2 = _sessione(db, numero=2)
    _piatto(db, s1)
    _piatto(db, s2)
    primo = _pagamento(db, s1, anna, importo="8.50")
    secondo = _pagamento(db, s2, anna, importo="9.00")
    _pagamento(db, s1, luca, importo="1.00")
    _pagamento(db, s1, None, importo="2.00")  # pagato da un ospite

    storico = client.get("/api/customer/payments", headers=header).json()
    assert [p["id"] for p in storico] == [secondo.id, primo.id]
    assert [p["amount"] for p in storico] == ["9.00", "8.50"]


def test_storico_proprio_conto_elenca_le_voci_pagate(client, db, customer_header):
    header, anna = customer_header()
    s = _sessione(db, numero=7)
    pizza = _piatto(db, s, "Pizza", "Pizze", "8.50", quantita=2)
    birra = _piatto(db, s, "Birra", "Bevande", "5.00", quantita=1)
    _pagamento(db, s, anna, PaymentMode.OWN, "13.50", righe=[(pizza, 1), (birra, 1)])

    voce = client.get("/api/customer/payments", headers=header).json()[0]
    assert voce["mode"] == "OWN"
    assert voce["table_number"] == 7
    assert voce["restaurant_name"] == "Trattoria Test"
    assert voce["session_opened_at"]
    assert voce["created_at"]
    assert {(i["name"], i["quantity"]) for i in voce["items"]} == {("Pizza", 1), ("Birra", 1)}
    pizza_voce = next(i for i in voce["items"] if i["name"] == "Pizza")
    assert pizza_voce["category"] == "Pizze"
    assert pizza_voce["unit_price"] == "8.50"


def test_storico_alla_romana_elenca_i_piatti_del_tavolo(client, db, customer_header):
    header, anna = customer_header()
    s = _sessione(db, numero=3)
    _piatto(db, s, "Pizza", "Pizze", "8.50", quantita=2)
    _piatto(db, s, "Birra", "Bevande", "5.00", quantita=3)
    _pagamento(db, s, anna, PaymentMode.ROMANA, "16.00")

    voce = client.get("/api/customer/payments", headers=header).json()[0]
    assert voce["mode"] == "ROMANA"
    assert {(i["name"], i["quantity"]) for i in voce["items"]} == {("Pizza", 2), ("Birra", 3)}


# --- collegamento dei pagamenti all account ---------------------------------------------------

TOKEN_TAVOLO = "token-del-tavolo"


@pytest.fixture
def tavolo_con_conto(db):
    s = _sessione(db, numero=9, coperti=2)
    s.table.qr_token = TOKEN_TAVOLO
    s.payment_mode = PaymentMode.ROMANA
    _piatto(db, s, "Pizza", "Pizze", "10.00", quantita=2)
    db.flush()
    return s


def _paga(client, sessione, headers=None):
    h = {"X-Table-Token": TOKEN_TAVOLO, **(headers or {})}
    return client.post(
        f"/api/public/tables/{sessione.table_id}/payments",
        json={"method": "ONLINE", "customer_nickname": "Anna Russo"},
        headers=h,
    )


def test_il_pagamento_di_un_cliente_loggato_finisce_nel_suo_storico(
    client, db, tavolo_con_conto, customer_header
):
    header, anna = customer_header()
    assert _paga(client, tavolo_con_conto, header).status_code == 201
    assert db.query(Payment).one().customer_id == anna.id
    assert len(client.get("/api/customer/payments", headers=header).json()) == 1


def test_senza_token_il_pagamento_resta_di_un_ospite(client, db, tavolo_con_conto):
    assert _paga(client, tavolo_con_conto).status_code == 201
    assert db.query(Payment).one().customer_id is None


@pytest.mark.parametrize("tipo", ["scaduto", "manomesso", "staff", "spazzatura"])
def test_un_token_non_valido_non_blocca_il_pagamento_ma_non_lo_collega(
    client, db, tavolo_con_conto, make_customer, auth_header, tipo
):
    cliente = make_customer()
    if tipo == "scaduto":
        token = create_customer_token(cliente, expires_in=timedelta(seconds=-1))
        header = {"Authorization": f"Bearer {token}"}
    elif tipo == "manomesso":
        token = jwt.encode({"sub": str(cliente.id), "typ": "customer"}, "altra", algorithm="HS256")
        header = {"Authorization": f"Bearer {token}"}
    elif tipo == "staff":
        header = auth_header(UserRole.WAITER)
    else:
        header = {"Authorization": "Bearer non-un-jwt"}
    assert _paga(client, tavolo_con_conto, header).status_code == 201
    assert db.query(Payment).one().customer_id is None
