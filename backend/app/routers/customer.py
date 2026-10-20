"""Account dei clienti: registrazione, login, profilo, storico dei pagamenti.

Chi paga al tavolo non ha bisogno di un account (vedi `public.py`): registrarsi serve a
ritrovare lo storico dei propri pagamenti e a non riscrivere i propri dati ogni volta.
I clienti stanno in una tabella a parte rispetto allo staff e i loro token hanno un tipo
diverso, così un token cliente non può mai valere come token staff.
"""

import hashlib
from collections import defaultdict
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import ratelimit
from app.config import settings
from app.deps import CurrentCustomer, DbSession
from app.errors import Conflict
from app.models import (
    Customer,
    MenuItem,
    OrderItem,
    Payment,
    PaymentItem,
    PaymentMode,
    Restaurant,
)
from app.schemas import (
    CustomerAuthOut,
    CustomerLoginIn,
    CustomerOut,
    CustomerPaymentItemOut,
    CustomerPaymentOut,
    CustomerRegisterIn,
    CustomerUpdateIn,
    DeleteAccountIn,
)
from app.security import create_customer_token, hash_password, verify_password

router = APIRouter(prefix="/api/customer", tags=["customer"])

# Quanti pagamenti restituisce lo storico (i più recenti).
STORICO_MAX = 100
_CREDENZIALI = "Credenziali non valide"


def _ip(request: Request) -> str:
    return ratelimit.ip_client(request.headers, request.client and request.client.host)


def _risposta(customer: Customer) -> CustomerAuthOut:
    return CustomerAuthOut(
        access_token=create_customer_token(customer),
        customer=CustomerOut.model_validate(customer),
    )


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def registrati(data: CustomerRegisterIn, request: Request, db: DbSession) -> CustomerAuthOut:
    # Ogni tentativo conta, riuscito o no: frena chi crea account in massa o prova le email.
    ratelimit.colpisci(
        f"cust-register:{_ip(request)}",
        settings.rate_limit_register_max,
        settings.rate_limit_register_window,
    )
    if db.scalar(select(Customer.id).where(Customer.email == data.email)) is not None:
        raise Conflict("Email già registrata")
    customer = Customer(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        city=data.city,
        privacy_accepted_at=datetime.now(UTC),
    )
    db.add(customer)
    try:
        db.commit()
    except IntegrityError:
        # Due registrazioni con la stessa email nello stesso istante: vince la prima.
        db.rollback()
        raise Conflict("Email già registrata") from None
    return _risposta(customer)


def _limiti_tentativi(chiave_ip: str, email: str) -> list[tuple[str, int]]:
    nome = hashlib.sha256(email.encode()).hexdigest()[:32]
    return [
        (f"cust-login-ip:{chiave_ip}", settings.rate_limit_login_ip_max),
        (f"cust-login-user:{nome}", settings.rate_limit_login_user_max),
    ]


@router.post("/auth/login")
def accedi(data: CustomerLoginIn, request: Request, db: DbSession) -> CustomerAuthOut:
    # Come per lo staff: si contano solo i tentativi falliti; esaurito il limite anche la
    # password giusta aspetta, altrimenti il limite non fermerebbe chi sta indovinando.
    limiti = _limiti_tentativi(_ip(request), data.email)
    finestra = settings.rate_limit_login_window
    for chiave, massimo in limiti:
        ratelimit.verifica(chiave, massimo, finestra)

    customer = db.scalar(select(Customer).where(Customer.email == data.email))
    # Stesso errore (e stesso costo di calcolo) per email inesistente e password errata.
    hash_ = customer.password_hash if customer else None
    if not verify_password(data.password, hash_) or customer is None:
        for chiave, massimo in limiti:
            ratelimit.colpisci(chiave, massimo, finestra)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _CREDENZIALI)
    return _risposta(customer)


@router.get("/me")
def profilo(customer: CurrentCustomer) -> CustomerOut:
    return CustomerOut.model_validate(customer)


@router.put("/me")
def aggiorna_profilo(
    data: CustomerUpdateIn, customer: CurrentCustomer, db: DbSession
) -> CustomerOut:
    customer.first_name = data.first_name
    customer.last_name = data.last_name
    customer.city = data.city
    db.commit()
    return CustomerOut.model_validate(customer)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def elimina_account(data: DeleteAccountIn, customer: CurrentCustomer, db: DbSession) -> Response:
    """Cancella l'account e i dati personali. I pagamenti restano (servono al ristorante) ma
    non sono più legati a nessuna persona. Serve la password: un telefono lasciato sbloccato
    non basta a distruggere l'account."""
    chiave = f"cust-delete:{customer.id}"
    massimo, finestra = settings.rate_limit_login_user_max, settings.rate_limit_login_window
    ratelimit.verifica(chiave, massimo, finestra)
    if not verify_password(data.password, customer.password_hash):
        ratelimit.colpisci(chiave, massimo, finestra)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Password non corretta")
    db.delete(customer)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _piatti(righe: list[tuple]) -> dict:
    """Raggruppa per chiave le righe (chiave, nome, categoria, quantità, prezzo)."""
    risultato = defaultdict(list)
    for chiave, nome, categoria, quantita, prezzo in righe:
        risultato[chiave].append(
            CustomerPaymentItemOut(
                name=nome, category=categoria, quantity=quantita, unit_price=prezzo
            )
        )
    return risultato


@router.get("/payments")
def storico_pagamenti(customer: CurrentCustomer, db: DbSession) -> list[CustomerPaymentOut]:
    pagamenti = db.scalars(
        select(Payment)
        .where(Payment.customer_id == customer.id)
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .limit(STORICO_MAX)
    ).all()
    if not pagamenti:
        return []

    # Proprio conto: i piatti che questa persona ha pagato.
    ids_own = [p.id for p in pagamenti if p.mode == PaymentMode.OWN]
    pagati = _piatti(
        [
            (pagamento_id, nome, categoria, quantita, prezzo)
            for pagamento_id, nome, categoria, quantita, prezzo in db.execute(
                select(
                    PaymentItem.payment_id,
                    MenuItem.name,
                    MenuItem.category,
                    PaymentItem.quantity,
                    OrderItem.unit_price,
                )
                .join(OrderItem, OrderItem.id == PaymentItem.order_item_id)
                .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
                .where(PaymentItem.payment_id.in_(ids_own))
                .order_by(PaymentItem.id)
            )
        ]
        if ids_own
        else [],
    )

    # Alla romana: la quota era una parte del conto, si mostrano tutti i piatti del tavolo.
    ids_sessione = {p.session_id for p in pagamenti if p.mode == PaymentMode.ROMANA}
    del_tavolo = _piatti(
        [
            (sessione_id, nome, categoria, quantita, prezzo)
            for sessione_id, nome, categoria, quantita, prezzo in db.execute(
                select(
                    OrderItem.session_id,
                    MenuItem.name,
                    MenuItem.category,
                    OrderItem.quantity,
                    OrderItem.unit_price,
                )
                .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
                .where(OrderItem.session_id.in_(ids_sessione))
                .order_by(OrderItem.id)
            )
        ]
        if ids_sessione
        else [],
    )

    storico = []
    for p in pagamenti:
        sessione = p.session
        tavolo = sessione.table
        storico.append(
            CustomerPaymentOut(
                id=p.id,
                amount=p.amount,
                mode=p.mode,
                method=p.method,
                status=p.status,
                created_at=p.created_at,
                session_opened_at=sessione.opened_at,
                table_number=tavolo.number,
                restaurant_name=db.get(Restaurant, tavolo.restaurant_id).name,
                items=pagati[p.id] if p.mode == PaymentMode.OWN else del_tavolo[p.session_id],
            )
        )
    return storico
