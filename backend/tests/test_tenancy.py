"""Isolamento tra ristoranti: ciò che è di un locale non si vede né si tocca da un altro.

Se togli un filtro per `restaurant_id` da un endpoint dello staff, qui deve fallire qualcosa.
"""

from decimal import Decimal

import pytest

from app.models import (
    MenuItem,
    OrderItem,
    Payment,
    PaymentMethod,
    PaymentMode,
    PaymentStatus,
    Restaurant,
    RestaurantTable,
    TableSession,
    UserRole,
)
from app.security import create_access_token
from app.slugs import RESERVED_SLUGS, slugify, valid_slug


def _locale(db, slug, name):
    r = Restaurant(name=name, slug=slug)
    db.add(r)
    db.flush()
    tavolo = RestaurantTable(restaurant_id=r.id, number=1, qr_token=f"token-{slug}")
    piatto = MenuItem(
        restaurant_id=r.id, name=f"Pizza {slug}", category="Primi", price=Decimal("8")
    )
    db.add_all([tavolo, piatto])
    db.flush()
    sessione = TableSession(table_id=tavolo.id, coperti=2)
    db.add(sessione)
    db.flush()
    riga = OrderItem(
        session_id=sessione.id, menu_item_id=piatto.id, quantity=1, unit_price=Decimal("8.00")
    )
    pagamento = Payment(
        session_id=sessione.id,
        amount=Decimal("4.00"),
        mode=PaymentMode.ROMANA,
        method=PaymentMethod.CASH,
        status=PaymentStatus.CASH,
        customer_nickname="Ospite",
    )
    db.add_all([riga, pagamento])
    db.flush()
    return {
        "r": r,
        "tavolo": tavolo,
        "piatto": piatto,
        "sessione": sessione,
        "riga": riga,
        "pagamento": pagamento,
    }


@pytest.fixture
def due(db):
    return _locale(db, "da-gino", "Da Gino"), _locale(db, "da-lia", "Da Lia")


def _header(user):
    return {"Authorization": f"Bearer {create_access_token(user)}"}


@pytest.fixture
def utenti(db, make_user, due):
    a, _ = due
    return {
        "admin": _header(make_user("admin-a", UserRole.ADMIN, restaurant=a["r"])),
        "waiter": _header(make_user("waiter-a", UserRole.WAITER, restaurant=a["r"])),
    }


# ---------- lettura: solo ciò che è mio ----------


def test_menu_completo_solo_del_proprio_ristorante(client, due, utenti):
    r = client.get("/api/menu/all", headers=utenti["admin"])
    assert [p["name"] for p in r.json()] == ["Pizza da-gino"]


def test_menu_per_staff_solo_del_proprio_ristorante(client, due, utenti):
    r = client.get("/api/menu", headers=utenti["waiter"])
    assert [p["name"] for p in r.json()] == ["Pizza da-gino"]


def test_elenco_tavoli_solo_del_proprio_ristorante(client, due, utenti):
    a, _ = due
    r = client.get("/api/tables", headers=utenti["waiter"])
    assert [t["id"] for t in r.json()] == [a["tavolo"].id]


def test_sessioni_aperte_solo_del_proprio_ristorante(client, due, utenti):
    a, _ = due
    r = client.get("/api/sessions/open", headers=utenti["waiter"])
    assert [s["id"] for s in r.json()] == [a["sessione"].id]


# ---------- scrittura e accesso a risorse altrui: sempre 404 ----------


def test_crea_piatto_e_tavolo_nel_proprio_ristorante(client, db, due, utenti):
    a, b = due
    r = client.post(
        "/api/menu",
        json={"name": "Tiramisù", "category": "Dolci", "price": "5.00"},
        headers=utenti["admin"],
    )
    assert r.status_code == 201
    assert db.get(MenuItem, r.json()["id"]).restaurant_id == a["r"].id
    # Stesso numero di tavolo in due locali diversi: ammesso.
    r = client.post("/api/tables", json={"number": 2}, headers=utenti["admin"])
    assert r.status_code == 201
    assert db.get(RestaurantTable, r.json()["id"]).restaurant_id == a["r"].id
    assert (
        client.post("/api/tables", json={"number": 1}, headers=utenti["admin"]).status_code == 409
    )


def test_piatto_altrui_404(client, due, utenti):
    _, b = due
    piatto = {"name": "X", "category": "Y", "price": "1.00"}
    url = f"/api/menu/{b['piatto'].id}"
    assert client.put(url, json=piatto, headers=utenti["admin"]).status_code == 404
    assert client.delete(url, headers=utenti["admin"]).status_code == 404


def test_tavolo_altrui_404(client, due, utenti):
    _, b = due
    t = b["tavolo"].id
    assert client.post(f"/api/tables/{t}/qr/regenerate", headers=utenti["admin"]).status_code == 404
    assert client.get(f"/api/tables/{t}/qr.svg", headers=utenti["admin"]).status_code == 404
    r = client.post("/api/sessions", json={"table_id": t, "coperti": 2}, headers=utenti["waiter"])
    assert r.status_code == 404


def test_sessione_altrui_404(client, due, utenti):
    _, b = due
    s = b["sessione"].id
    h = utenti["waiter"]
    assert client.get(f"/api/sessions/{s}", headers=h).status_code == 404
    assert (
        client.put(
            f"/api/sessions/{s}/mode", json={"payment_mode": "ROMANA"}, headers=h
        ).status_code
        == 404
    )
    assert client.get(f"/api/sessions/{s}/payments", headers=h).status_code == 404
    assert client.post(f"/api/sessions/{s}/close", headers=h).status_code == 404
    assert (
        client.post(
            f"/api/sessions/{s}/payments",
            json={"method": "CASH", "customer_nickname": "X"},
            headers=h,
        ).status_code
        == 404
    )


def test_ordini_di_sessione_altrui_404(client, due, utenti):
    _, b = due
    s = b["sessione"].id
    h = utenti["waiter"]
    assert client.get(f"/api/sessions/{s}/orders", headers=h).status_code == 404
    r = client.post(
        f"/api/sessions/{s}/orders", json={"menu_item_id": b["piatto"].id, "quantity": 1}, headers=h
    )
    assert r.status_code == 404
    assert client.delete(f"/api/sessions/{s}/orders/{b['riga'].id}", headers=h).status_code == 404


def test_piatto_altrui_non_ordinabile_nella_propria_sessione(client, db, due, utenti):
    a, b = due
    db.delete(a["pagamento"])  # con un pagamento la sessione non accetta più ordini (409)
    db.flush()
    r = client.post(
        f"/api/sessions/{a['sessione'].id}/orders",
        json={"menu_item_id": b["piatto"].id, "quantity": 1},
        headers=utenti["waiter"],
    )
    assert r.status_code == 404


def test_conferma_pagamento_altrui_404(client, db, due, utenti):
    _, b = due
    r = client.put(f"/api/payments/{b['pagamento'].id}/confirm", headers=utenti["waiter"])
    assert r.status_code == 404
    db.refresh(b["pagamento"])
    assert b["pagamento"].status == PaymentStatus.CASH


def test_conferma_pagamento_proprio_ok(client, due, utenti):
    a, _ = due
    r = client.put(f"/api/payments/{a['pagamento'].id}/confirm", headers=utenti["waiter"])
    assert r.status_code == 200


# ---------- ruoli, utenti e ristoranti disattivati ----------


def test_superadmin_non_opera_sui_dati_dei_locali(client, make_user):
    h = _header(make_user("capo", UserRole.SUPERADMIN, restaurant=None))
    assert client.get("/api/tables", headers=h).status_code == 403
    assert client.get("/api/menu/all", headers=h).status_code == 403
    assert client.get("/api/sessions/open", headers=h).status_code == 403


def test_ristorante_disattivato_blocca_lo_staff(client, db, due, utenti):
    a, _ = due
    a["r"].active = False
    db.flush()
    assert client.get("/api/tables", headers=utenti["waiter"]).status_code == 401


def test_utente_disattivato_blocca_il_token(client, db, make_user, due):
    a, _ = due
    user = make_user("ex", UserRole.WAITER, restaurant=a["r"])
    h = _header(user)
    assert client.get("/api/tables", headers=h).status_code == 200
    user.active = False
    db.flush()
    assert client.get("/api/tables", headers=h).status_code == 401


def test_staff_senza_ristorante_non_opera(client, make_user):
    h = _header(make_user("orfano", UserRole.ADMIN, restaurant=None))
    assert client.get("/api/tables", headers=h).status_code == 403


# ---------- clienti: tavolo di un ristorante disattivato e menu pubblico per slug ----------


def test_tavolo_di_ristorante_disattivato_non_accessibile_ai_clienti(client, db, due):
    a, _ = due
    ok = client.get(
        f"/api/public/tables/{a['tavolo'].id}", headers={"X-Table-Token": "token-da-gino"}
    )
    assert ok.status_code == 200
    a["r"].active = False
    db.flush()
    r = client.get(
        f"/api/public/tables/{a['tavolo'].id}", headers={"X-Table-Token": "token-da-gino"}
    )
    assert r.status_code == 404


def test_menu_pubblico_per_slug_solo_disponibili(client, db, due):
    a, _ = due
    db.add(
        MenuItem(
            restaurant_id=a["r"].id,
            name="Nascosto",
            category="X",
            price=Decimal("1"),
            available=False,
        )
    )
    db.flush()
    r = client.get("/api/public/restaurants/da-gino/menu")
    assert r.status_code == 200
    assert [p["name"] for p in r.json()] == ["Pizza da-gino"]


def test_ristorante_pubblico_per_slug(client, db, due):
    r = client.get("/api/public/restaurants/da-lia")
    assert r.status_code == 200
    assert r.json() == {"slug": "da-lia", "name": "Da Lia"}
    assert client.get("/api/public/restaurants/non-esiste").status_code == 404
    due[1]["r"].active = False
    db.flush()
    assert client.get("/api/public/restaurants/da-lia").status_code == 404
    assert client.get("/api/public/restaurants/da-lia/menu").status_code == 404


# ---------- login con lo slug ----------


def test_login_staff_con_slug(client, make_user, due):
    a, b = due
    make_user("mario", UserRole.WAITER, "segreta-lunga-1", restaurant=a["r"])
    body = {"username": "mario", "password": "segreta-lunga-1"}
    ok = client.post("/api/auth/login", json={**body, "restaurant": "da-gino"})
    assert ok.status_code == 200
    # Stesso utente, altro locale: non entra.
    assert client.post("/api/auth/login", json={**body, "restaurant": "da-lia"}).status_code == 401


def test_stesso_username_in_due_ristoranti(client, make_user, due):
    a, b = due
    make_user("mario", UserRole.WAITER, "password-gino-1", restaurant=a["r"])
    make_user("mario", UserRole.WAITER, "password-lia-12", restaurant=b["r"])
    r = client.post(
        "/api/auth/login",
        json={"username": "mario", "password": "password-lia-12", "restaurant": "da-lia"},
    )
    assert r.status_code == 200


def test_login_superadmin_senza_slug_e_staff_non_entra_con_slug_altrui(client, make_user, due):
    make_user("capo", UserRole.SUPERADMIN, "password-capo-12", restaurant=None)
    r = client.post("/api/auth/login", json={"username": "capo", "password": "password-capo-12"})
    assert r.status_code == 200 and r.json()["role"] == "SUPERADMIN"
    # Il superadmin non è staff di un locale: con uno slug non entra.
    r = client.post(
        "/api/auth/login",
        json={"username": "capo", "password": "password-capo-12", "restaurant": "da-gino"},
    )
    assert r.status_code == 401


def test_login_transitorio_senza_slug_trova_lo_staff_se_univoco(client, make_user, due):
    """Finché il frontend non invia lo slug (fase 3c), un username unico entra comunque."""
    a, b = due
    make_user("solo", UserRole.ADMIN, "password-solo-12", restaurant=a["r"])
    r = client.post("/api/auth/login", json={"username": "solo", "password": "password-solo-12"})
    assert r.status_code == 200
    make_user("doppio", UserRole.WAITER, "password-doppia-1", restaurant=a["r"])
    make_user("doppio", UserRole.WAITER, "password-doppia-1", restaurant=b["r"])
    r = client.post("/api/auth/login", json={"username": "doppio", "password": "password-doppia-1"})
    assert r.status_code == 401


def test_login_ristorante_disattivato_rifiutato(client, db, make_user, due):
    a, _ = due
    make_user("mario", UserRole.WAITER, "segreta-lunga-1", restaurant=a["r"])
    a["r"].active = False
    db.flush()
    r = client.post(
        "/api/auth/login",
        json={"username": "mario", "password": "segreta-lunga-1", "restaurant": "da-gino"},
    )
    assert r.status_code == 401


# ---------- slug ----------


@pytest.mark.parametrize("slug", ["da-gino", "trattoria-2", "abc"])
def test_slug_validi(slug):
    assert valid_slug(slug)


@pytest.mark.parametrize(
    "slug", ["", "ab", "Da-Gino", "da gino", "-gino", "gino-", "da--gino", "x" * 41, "è-bello"]
)
def test_slug_non_validi(slug):
    assert not valid_slug(slug)


def test_slug_riservati_non_validi():
    assert RESERVED_SLUGS
    for slug in RESERVED_SLUGS:
        assert not valid_slug(slug)


def test_slugify():
    assert slugify("Trattoria Da Gino!") == "trattoria-da-gino"
    assert slugify("Caffè  dell'Angolo") == "caffe-dell-angolo"
    assert slugify("!!") == "ristorante"


# ---------- casi aggiunti dopo la revisione di sicurezza ----------


def test_voce_di_altra_sessione_non_pagabile_in_own(client, db, due, utenti):
    a, b = due
    a["sessione"].payment_mode = PaymentMode.OWN
    db.delete(a["pagamento"])
    db.flush()
    r = client.post(
        f"/api/sessions/{a['sessione'].id}/payments",
        json={
            "method": "CASH",
            "customer_nickname": "X",
            "items": [{"order_item_id": b["riga"].id, "quantity": 1}],
        },
        headers=utenti["waiter"],
    )
    assert r.status_code == 404
    db.refresh(b["riga"])
    assert db.query(Payment).filter(Payment.session_id == b["sessione"].id).count() == 1


def test_cameriere_non_usa_le_rotte_da_admin(client, due, utenti):
    _, b = due
    h = utenti["waiter"]
    assert client.get("/api/menu/all", headers=h).status_code == 403
    assert client.post("/api/tables", json={"number": 9}, headers=h).status_code == 403
    assert client.get(f"/api/tables/{b['tavolo'].id}/qr.svg", headers=h).status_code == 403


def test_login_utente_disattivato_con_password_giusta_rifiutato(client, db, make_user, due):
    a, _ = due
    user = make_user("mario", UserRole.WAITER, "segreta-lunga-1", restaurant=a["r"])
    user.active = False
    db.flush()
    r = client.post(
        "/api/auth/login",
        json={"username": "mario", "password": "segreta-lunga-1", "restaurant": "da-gino"},
    )
    assert r.status_code == 401
