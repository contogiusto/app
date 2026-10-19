from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

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


class PublicOrderItemOut(BaseModel):
    id: int
    name: str
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
    items: list[PublicOrderItemOut]
    payments: list[PublicPaymentOut]


class PublicTableOut(BaseModel):
    table_number: int
    session: PublicSessionOut | None
