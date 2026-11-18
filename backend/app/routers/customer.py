"""Account dei clienti: registrazione, login, profilo, storico dei pagamenti.

Chi paga al tavolo non ha bisogno di un account (vedi `public.py`): registrarsi serve a
ritrovare lo storico dei propri pagamenti e a non riscrivere i propri dati ogni volta.
I clienti stanno in una tabella a parte rispetto allo staff e i loro token hanno un tipo
diverso, così un token cliente non può mai valere come token staff.
"""

import hashlib
import secrets
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response, status
from sqlalchemy import delete, distinct, func, select, update
from sqlalchemy.exc import IntegrityError

from app import ratelimit
from app.config import settings
from app.deps import CurrentCustomer, DbSession
from app.email import send_email
from app.errors import Conflict, Invalid
from app.models import (
    Customer,
    MenuItem,
    OrderItem,
    PasswordResetToken,
    Payment,
    PaymentItem,
    PaymentMode,
    PaymentStatus,
    Restaurant,
    RestaurantTable,
    TableSession,
)
from app.schemas import (
    CustomerAuthOut,
    CustomerLoginIn,
    CustomerOut,
    CustomerPasswordChangeIn,
    CustomerPaymentItemOut,
    CustomerPaymentOut,
    CustomerRegisterIn,
    CustomerUpdateIn,
    DeleteAccountIn,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    VisitedRestaurantOut,
)
from app.security import create_customer_token, hash_password, verify_password

router = APIRouter(prefix="/api/customer", tags=["customer"])

# Quanti pagamenti restituisce lo storico (i più recenti).
STORICO_MAX = 100
# Al posto del nome digitato al tavolo sui pagamenti di un account eliminato.
NOME_CLIENTE_ELIMINATO = "Cliente eliminato"
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


_RESET_RISPOSTA = (
    "Se l'email è registrata, ti abbiamo inviato il link per scegliere una nuova password."
)
_LINK_NON_VALIDO = "Il link non è valido o è scaduto: richiedine uno nuovo"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _durata(minuti: int) -> str:
    return "1 ora" if minuti == 60 else f"{minuti} minuti"


@router.post("/auth/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def richiedi_reset(
    data: PasswordResetRequestIn,
    request: Request,
    db: DbSession,
    background: BackgroundTasks,
) -> dict[str, str]:
    """Spedisce il link di recupero password. La risposta è sempre la stessa, anche per email
    non registrate (nessun modo di scoprire chi ha un account); ogni richiesta conta nei limiti,
    per IP e per email, così non si usa l'endpoint per spedire email in massa."""
    finestra = settings.rate_limit_reset_window
    nome = hashlib.sha256(data.email.encode()).hexdigest()[:32]
    ratelimit.colpisci(f"cust-reset-ip:{_ip(request)}", settings.rate_limit_reset_ip_max, finestra)
    ratelimit.colpisci(f"cust-reset-email:{nome}", settings.rate_limit_reset_email_max, finestra)

    # Pulizia opportunistica: i link scaduti da più di un giorno non servono più.
    db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.expires_at < datetime.now(UTC) - timedelta(days=1)
        )
    )
    customer = db.scalar(select(Customer).where(Customer.email == data.email))
    if customer is not None:
        token = secrets.token_urlsafe(32)
        ttl = settings.password_reset_ttl_minutes
        db.add(
            PasswordResetToken(
                customer_id=customer.id,
                token_hash=_hash_token(token),
                expires_at=datetime.now(UTC) + timedelta(minutes=ttl),
            )
        )
        db.commit()
        # Il token sta nel frammento (#): il browser non lo manda al server né nel Referer.
        link = f"{settings.frontend_url}/reset-password#token={token}"
        testo = (
            "Ciao,\n\nhai chiesto di scegliere una nuova password per il tuo account "
            "Conto Giusto.\n"
            f"Apri questo link (vale {_durata(ttl)} e una volta sola):\n\n{link}\n\n"
            "Se non sei stato tu, ignora questo messaggio: la tua password resta com'è."
        )
        background.add_task(send_email, customer.email, "Nuova password per Conto Giusto", testo)
    return {"detail": _RESET_RISPOSTA}


@router.post("/auth/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
def conferma_reset(data: PasswordResetConfirmIn, request: Request, db: DbSession) -> Response:
    chiave = f"cust-reset-fail:{_ip(request)}"
    massimo, finestra = settings.rate_limit_reset_fail_max, settings.rate_limit_reset_window
    ratelimit.verifica(chiave, massimo, finestra)
    ora = datetime.now(UTC)
    record = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == _hash_token(data.token))
    )
    # Stesso errore per link sconosciuto, già usato o scaduto: nessun indizio per chi indovina.
    if record is None or record.used_at is not None or record.expires_at <= ora:
        ratelimit.colpisci(chiave, massimo, finestra)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, _LINK_NON_VALIDO)
    customer = db.get(Customer, record.customer_id)
    customer.password_hash = hash_password(data.password)
    customer.password_changed_at = ora  # i suoi token di accesso attuali non valgono più
    # Chiude questo link e tutti gli altri ancora aperti dello stesso cliente.
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.customer_id == customer.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=ora)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/password")
def cambia_password(
    data: CustomerPasswordChangeIn, customer: CurrentCustomer, db: DbSession
) -> CustomerAuthOut:
    """Cambio della propria password (chiede quella attuale). I token emessi prima non valgono
    più: si risponde con uno nuovo per questa sessione."""
    chiave = f"cust-change-pw:{customer.id}"
    massimo, finestra = settings.rate_limit_login_user_max, settings.rate_limit_login_window
    ratelimit.verifica(chiave, massimo, finestra)
    if not verify_password(data.current_password, customer.password_hash):
        ratelimit.colpisci(chiave, massimo, finestra)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "La password attuale non è corretta")
    if data.new_password == data.current_password:
        raise Invalid("La nuova password dev'essere diversa da quella attuale")
    ora = datetime.now(UTC)
    customer.password_hash = hash_password(data.new_password)
    customer.password_changed_at = ora
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.customer_id == customer.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=ora)
    )
    db.commit()
    return _risposta(customer)


@router.get("/restaurants")
def ristoranti_visitati(customer: CurrentCustomer, db: DbSession) -> list[VisitedRestaurantOut]:
    """I ristoranti dove il cliente ha pagato (anche alla cassa), dall'ultimo visitato."""
    ultima = func.max(Payment.created_at)
    righe = db.execute(
        select(
            Restaurant.slug,
            Restaurant.name,
            func.count(distinct(Payment.session_id)),
            ultima,
            func.sum(Payment.amount),
        )
        .join(TableSession, TableSession.id == Payment.session_id)
        .join(RestaurantTable, RestaurantTable.id == TableSession.table_id)
        .join(Restaurant, Restaurant.id == RestaurantTable.restaurant_id)
        .where(
            Payment.customer_id == customer.id,
            Payment.status.in_([PaymentStatus.COMPLETED, PaymentStatus.CASH]),
            Restaurant.slug.is_not(None),
        )
        .group_by(Restaurant.id)
        .order_by(ultima.desc())
    ).all()
    return [
        VisitedRestaurantOut(slug=s, name=n, visits=v, last_visit=u, total_paid=t)
        for s, n, v, u, t in righe
    ]


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
    non sono più legati a nessuna persona, e il nome che l'utente aveva digitato al tavolo
    (di solito nome e cognome) viene sostituito. Serve la password: un telefono lasciato
    sbloccato non basta a distruggere l'account."""
    chiave = f"cust-delete:{customer.id}"
    massimo, finestra = settings.rate_limit_login_user_max, settings.rate_limit_login_window
    ratelimit.verifica(chiave, massimo, finestra)
    if not verify_password(data.password, customer.password_hash):
        ratelimit.colpisci(chiave, massimo, finestra)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Password non corretta")
    # Prima di cancellare l'account: dopo, il collegamento ai suoi pagamenti non c'è più.
    db.execute(
        update(Payment)
        .where(Payment.customer_id == customer.id)
        .values(customer_nickname=NOME_CLIENTE_ELIMINATO)
    )
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
def storico_pagamenti(
    customer: CurrentCustomer, db: DbSession, restaurant: str | None = None
) -> list[CustomerPaymentOut]:
    """Lo storico del cliente; con `restaurant` (slug) solo i pagamenti di quel ristorante."""
    query = select(Payment).where(Payment.customer_id == customer.id)
    if restaurant is not None:
        sessioni = (
            select(TableSession.id)
            .join(RestaurantTable, RestaurantTable.id == TableSession.table_id)
            .join(Restaurant, Restaurant.id == RestaurantTable.restaurant_id)
            .where(Restaurant.slug == restaurant)
        )
        query = query.where(Payment.session_id.in_(sessioni))
    pagamenti = db.scalars(
        query.order_by(Payment.created_at.desc(), Payment.id.desc()).limit(STORICO_MAX)
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
                restaurant_slug=db.get(Restaurant, tavolo.restaurant_id).slug,
                items=pagati[p.id] if p.mode == PaymentMode.OWN else del_tavolo[p.session_id],
            )
        )
    return storico
