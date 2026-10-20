from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
)

from app.models import PaymentMethod, PaymentMode, PaymentStatus, SessionStatus, UserRole

Prezzo = Annotated[Decimal, Field(ge=0, max_digits=8, decimal_places=2)]


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: UserRole


class MenuItemIn(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    category: Annotated[str, Field(min_length=1, max_length=60)]
    price: Prezzo
    available: bool = True


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    # Stringa con due decimali ("8.50"): niente errori di arrotondamento lato client.
    price: Annotated[Decimal, Field(decimal_places=2)]
    available: bool


class TableIn(BaseModel):
    number: Annotated[int, Field(ge=1, le=9999)]


class TableOut(BaseModel):
    id: int
    number: int
    # Id della sessione aperta sul tavolo, se c'e'.
    open_session_id: int | None


class SessionIn(BaseModel):
    table_id: int
    coperti: Annotated[int, Field(ge=1, le=100)]


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    table_id: int
    status: SessionStatus
    coperti: int
    payment_mode: PaymentMode | None
    total: Decimal


class OpenSessionOut(BaseModel):
    """Riepilogo di una sessione aperta, per l'elenco tavoli del cameriere."""

    id: int
    table_id: int
    coperti: int
    payment_mode: PaymentMode | None
    total: Decimal
    # Somma dei pagamenti registrati, contanti in attesa di conferma compresi.
    paid_total: Decimal
    # Pagamenti alla cassa che il cameriere deve ancora confermare.
    cash_pending: int


class OrderIn(BaseModel):
    menu_item_id: int
    quantity: Annotated[int, Field(ge=1, le=99)]


class OrderItemOut(BaseModel):
    id: int
    menu_item_id: int
    name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class OrderListOut(BaseModel):
    items: list[OrderItemOut]
    total: Decimal


class ModeIn(BaseModel):
    payment_mode: PaymentMode


class PaymentItemIn(BaseModel):
    order_item_id: int
    quantity: Annotated[int, Field(ge=1, le=99)]


class PaymentIn(BaseModel):
    method: PaymentMethod
    customer_nickname: Annotated[str, Field(min_length=1, max_length=80)]
    # Solo per la modalità OWN: le voci (e quantità) che questa persona paga.
    items: list[PaymentItemIn] | None = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    amount: Decimal
    mode: PaymentMode
    method: PaymentMethod
    status: PaymentStatus
    customer_nickname: str


class PaymentListOut(BaseModel):
    items: list[PaymentOut]
    paid_total: Decimal
    remaining: Decimal


# --- Account dei clienti -------------------------------------------------------------------

Nome = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


def _citta_o_vuota(value: str | None) -> str | None:
    """Spazi tolti; una città vuota equivale a nessuna città."""
    value = (value or "").strip()
    return value or None


class CustomerRegisterIn(BaseModel):
    email: EmailStr
    # Massimo 128: l'hash delle password lunghissime sarebbe un modo per appesantire il server.
    password: Annotated[str, Field(min_length=8, max_length=128)]
    first_name: Nome
    last_name: Nome
    city: Annotated[str | None, Field(max_length=100)] = None
    accept_privacy: bool

    @field_validator("email")
    @classmethod
    def _email_minuscola(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("city")
    @classmethod
    def _citta(cls, value: str | None) -> str | None:
        return _citta_o_vuota(value)

    @field_validator("accept_privacy")
    @classmethod
    def _privacy_accettata(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Per registrarti devi accettare l'informativa sulla privacy")
        return value


class CustomerLoginIn(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(max_length=128)]

    @field_validator("email")
    @classmethod
    def _email_minuscola(cls, value: str) -> str:
        return value.strip().lower()


class CustomerUpdateIn(BaseModel):
    first_name: Nome
    last_name: Nome
    city: Annotated[str | None, Field(max_length=100)] = None

    @field_validator("city")
    @classmethod
    def _citta(cls, value: str | None) -> str | None:
        return _citta_o_vuota(value)


class DeleteAccountIn(BaseModel):
    password: Annotated[str, Field(max_length=128)]


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: str
    last_name: str
    city: str | None


class CustomerAuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: CustomerOut


class CustomerPaymentItemOut(BaseModel):
    name: str
    category: str
    quantity: int
    unit_price: Decimal


class CustomerPaymentOut(BaseModel):
    """Una voce dello storico. Con `mode` OWN gli `items` sono i piatti che il cliente ha
    pagato; con ROMANA sono tutti i piatti del tavolo (la quota era una parte del totale)."""

    id: int
    amount: Decimal
    mode: PaymentMode
    method: PaymentMethod
    status: PaymentStatus
    created_at: datetime
    session_opened_at: datetime
    table_number: int
    restaurant_name: str
    items: list[CustomerPaymentItemOut]


class PublicOrderItemOut(BaseModel):
    id: int
    name: str
    category: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    paid_quantity: int


class PublicPaymentOut(BaseModel):
    """Cosa vedono gli altri commensali: nome, importo e stato, nient'altro."""

    model_config = ConfigDict(from_attributes=True)

    customer_nickname: str
    amount: Decimal
    method: PaymentMethod
    status: PaymentStatus


class PublicSessionOut(BaseModel):
    id: int
    status: SessionStatus
    coperti: int
    payment_mode: PaymentMode | None
    total: Decimal
    paid_total: Decimal
    remaining: Decimal
    # Alla romana: quanto pagherebbe ora la prossima persona (calcolato dal server).
    next_share: Decimal | None
    items: list[PublicOrderItemOut]
    payments: list[PublicPaymentOut]


class PublicTableOut(BaseModel):
    restaurant_name: str
    table_number: int
    session: PublicSessionOut | None
