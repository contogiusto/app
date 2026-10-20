"""Modello dati del dominio (vedi docs/domain.md)."""

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UserRole(enum.StrEnum):
    ADMIN = "ADMIN"
    WAITER = "WAITER"


class SessionStatus(enum.StrEnum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class PaymentMode(enum.StrEnum):
    """Scelta di tutto il tavolo: ROMANA divide per coperti, OWN ognuno i propri piatti."""

    ROMANA = "ROMANA"
    OWN = "OWN"


class PaymentMethod(enum.StrEnum):
    """Scelta del singolo pagamento: ONLINE (simulato) o CASH (alla cassa)."""

    ONLINE = "ONLINE"
    CASH = "CASH"


class PaymentStatus(enum.StrEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CASH = "CASH"  # dichiarato alla cassa, in attesa di conferma del cameriere


def _enum(cls: type[enum.Enum], name: str) -> Enum:
    # Stringa + CHECK invece di ENUM nativo Postgres: le migration restano semplici.
    return Enum(cls, name=name, native_enum=False, create_constraint=True, length=16)


class AppUser(Base):
    __tablename__ = "app_user"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(_enum(UserRole, "user_role"))


class Restaurant(Base):
    __tablename__ = "restaurant"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))


class MenuItem(Base):
    __tablename__ = "menu_item"
    __table_args__ = (CheckConstraint("price >= 0", name="menu_item_price_non_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurant.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    available: Mapped[bool] = mapped_column(default=True, server_default=true())


class RestaurantTable(Base):
    __tablename__ = "restaurant_table"
    __table_args__ = (UniqueConstraint("restaurant_id", "number", name="uq_table_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurant.id"), index=True)
    number: Mapped[int]
    qr_token: Mapped[str] = mapped_column(String(64), unique=True)


class TableSession(Base):
    """Sessione di un tavolo (apertura → pagamenti → chiusura). Entità centrale."""

    __tablename__ = "table_session"
    __table_args__ = (
        CheckConstraint("coperti > 0", name="table_session_coperti_positive"),
        # Max una sessione aperta per tavolo, garantito dal DB anche con richieste concorrenti.
        Index(
            "uq_table_session_one_open",
            "table_id",
            unique=True,
            postgresql_where=text("status = 'OPEN'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("restaurant_table.id"), index=True)
    status: Mapped[SessionStatus] = mapped_column(
        _enum(SessionStatus, "session_status"), default=SessionStatus.OPEN
    )
    coperti: Mapped[int]
    # Null finché la prima persona al tavolo non sceglie la modalità.
    payment_mode: Mapped[PaymentMode | None] = mapped_column(_enum(PaymentMode, "payment_mode"))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Lock ottimistico: un aggiornamento su dati obsoleti fallisce (→ HTTP 409).
    version: Mapped[int] = mapped_column(default=1)

    __mapper_args__ = {"version_id_col": version}

    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="session")
    payments: Mapped[list["Payment"]] = relationship(back_populates="session")


class OrderItem(Base):
    __tablename__ = "order_item"
    __table_args__ = (CheckConstraint("quantity > 0", name="order_item_quantity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("table_session.id"), index=True)
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_item.id"))
    quantity: Mapped[int]
    # Prezzo congelato all'ordine: cambiare il menu non altera i conti già aperti.
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    added_by: Mapped[int | None] = mapped_column(ForeignKey("app_user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[TableSession] = relationship(back_populates="order_items")
    menu_item: Mapped[MenuItem] = relationship()


class Payment(Base):
    __tablename__ = "payment"
    __table_args__ = (CheckConstraint("amount > 0", name="payment_amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("table_session.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    mode: Mapped[PaymentMode] = mapped_column(_enum(PaymentMode, "payment_mode"))
    method: Mapped[PaymentMethod] = mapped_column(_enum(PaymentMethod, "payment_method"))
    status: Mapped[PaymentStatus] = mapped_column(
        _enum(PaymentStatus, "payment_status"), default=PaymentStatus.PENDING
    )
    customer_nickname: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[TableSession] = relationship(back_populates="payments")
    items: Mapped[list["PaymentItem"]] = relationship(back_populates="payment")


class PaymentItem(Base):
    """Voce pagata: usata solo in modalità OWN."""

    __tablename__ = "payment_item"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="payment_item_quantity_positive"),
        UniqueConstraint("payment_id", "order_item_id", name="uq_payment_order_item"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payment.id"), index=True)
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_item.id"), index=True)
    quantity: Mapped[int]

    payment: Mapped[Payment] = relationship(back_populates="items")


class RateLimitCounter(Base):
    """Contatore del rate limit: una riga per (chiave, finestra). Vedi app/ratelimit.py."""

    __tablename__ = "rate_limit_counter"
    __table_args__ = (Index("ix_rate_limit_counter_expires_at", "expires_at"),)

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    count: Mapped[int]
