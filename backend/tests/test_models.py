from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm.exc import StaleDataError

from app.models import (
    MenuItem,
    OrderItem,
    Payment,
    PaymentItem,
    PaymentMethod,
    PaymentMode,
    PaymentStatus,
    Restaurant,
    RestaurantTable,
    SessionStatus,
    TableSession,
)


@pytest.fixture
def restaurant(db):
    r = Restaurant(name="Trattoria Test")
    db.add(r)
    db.flush()
    return r


@pytest.fixture
def table(db, restaurant):
    t = RestaurantTable(restaurant_id=restaurant.id, number=1, qr_token="tok-1")
    db.add(t)
    db.flush()
    return t


@pytest.fixture
def dining(db, table):
    s = TableSession(table_id=table.id, coperti=4)
    db.add(s)
    db.flush()
    return s


@pytest.fixture
def menu_item(db, restaurant):
    m = MenuItem(
        restaurant_id=restaurant.id, name="Margherita", category="Pizze", price=Decimal("8.50")
    )
    db.add(m)
    db.flush()
    return m


def test_sessione_nasce_aperta_senza_modalita_di_pagamento(dining):
    assert dining.status == SessionStatus.OPEN
    assert dining.payment_mode is None
    assert dining.opened_at is not None
    assert dining.closed_at is None


def test_menu_item_disponibile_di_default(menu_item):
    assert menu_item.available is True


def test_numero_tavolo_unico_per_ristorante(db, restaurant, table):
    db.add(RestaurantTable(restaurant_id=restaurant.id, number=1, qr_token="altro"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_qr_token_unico(db, restaurant, table):
    db.add(RestaurantTable(restaurant_id=restaurant.id, number=2, qr_token="tok-1"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_coperti_devono_essere_positivi(db, table):
    db.add(TableSession(table_id=table.id, coperti=0))
    with pytest.raises(IntegrityError):
        db.flush()


def test_ordine_conserva_il_prezzo_al_momento_dell_ordine(db, dining, menu_item):
    item = OrderItem(
        session_id=dining.id, menu_item_id=menu_item.id, quantity=2, unit_price=menu_item.price
    )
    db.add(item)
    db.flush()
    menu_item.price = Decimal("9.90")
    db.flush()
    db.refresh(item)
    assert item.unit_price == Decimal("8.50")


def test_quantita_ordine_positiva(db, dining, menu_item):
    db.add(
        OrderItem(
            session_id=dining.id, menu_item_id=menu_item.id, quantity=0, unit_price=Decimal("1")
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_pagamento_con_voci_per_modalita_own(db, dining, menu_item):
    item = OrderItem(
        session_id=dining.id, menu_item_id=menu_item.id, quantity=1, unit_price=Decimal("8.50")
    )
    db.add(item)
    db.flush()
    payment = Payment(
        session_id=dining.id,
        amount=Decimal("8.50"),
        mode=PaymentMode.OWN,
        method=PaymentMethod.CASH,
        status=PaymentStatus.CASH,
        customer_nickname="Mario Rossi",
    )
    db.add(payment)
    db.flush()
    db.add(PaymentItem(payment_id=payment.id, order_item_id=item.id, quantity=1))
    db.flush()
    db.refresh(payment)
    assert [p.order_item_id for p in payment.items] == [item.id]


def test_lock_ottimistico_sulla_sessione(db, dining):
    dining.coperti = 5
    db.flush()
    assert dining.version == 2

    # Una seconda sessione ORM con una copia obsoleta non può sovrascrivere.
    other = OrmSession(bind=db.get_bind(), join_transaction_mode="create_savepoint")
    try:
        stale = other.get(TableSession, dining.id)
        stale.version  # noqa: B018
        dining.coperti = 6
        db.flush()
        stale.coperti = 7
        with pytest.raises(StaleDataError):
            other.flush()
    finally:
        other.rollback()
        other.close()
