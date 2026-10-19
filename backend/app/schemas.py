from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models import PaymentMode, SessionStatus, UserRole

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
