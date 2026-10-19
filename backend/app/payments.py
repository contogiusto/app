"""Regole dei pagamenti: modalità del tavolo, quote, chiusura della sessione.

Le funzioni non fanno commit: lo fa chi le chiama (l'endpoint). La sessione viene bloccata
con SELECT ... FOR UPDATE, così due pagamenti simultanei sullo stesso tavolo si accodano e
non possono superare i coperti né pagare due volte la stessa voce.
"""

from datetime import UTC, datetime
from decimal import ROUND_DOWN, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import Conflict, Invalid, NotFound
from app.models import (
    OrderItem,
    Payment,
    PaymentItem,
    PaymentMethod,
    PaymentMode,
    PaymentStatus,
    SessionStatus,
    TableSession,
)
from app.routers.orders import totale_sessione

CENT = Decimal("0.01")


def _blocca_sessione(db: Session, session_id: int) -> TableSession:
    session = db.get(TableSession, session_id, with_for_update=True)
    if session is None:
        raise NotFound("Sessione non trovata")
    return session


def _sessione_aperta(db: Session, session_id: int) -> TableSession:
    session = _blocca_sessione(db, session_id)
    if session.status != SessionStatus.OPEN:
        raise Conflict("La sessione è chiusa")
    return session


def _chiudi(session: TableSession) -> None:
    session.status = SessionStatus.CLOSED
    session.closed_at = datetime.now(UTC)


def imposta_modalita(db: Session, session_id: int, mode: PaymentMode) -> TableSession:
    """Idempotente: la prima scelta vale per tutto il tavolo, le successive non cambiano nulla."""
    session = _sessione_aperta(db, session_id)
    if session.payment_mode is None:
        session.payment_mode = mode
    return session


def _quantita_pagate(db: Session, session_id: int) -> dict[int, int]:
    rows = db.execute(
        select(PaymentItem.order_item_id, func.sum(PaymentItem.quantity))
        .join(Payment, Payment.id == PaymentItem.payment_id)
        .where(Payment.session_id == session_id)
        .group_by(PaymentItem.order_item_id)
    ).all()
    return {order_item_id: int(qty) for order_item_id, qty in rows}


def _pagamenti(db: Session, session_id: int) -> list[Payment]:
    return list(
        db.scalars(select(Payment).where(Payment.session_id == session_id).order_by(Payment.id))
    )


def _importo_romana(db: Session, session: TableSession, precedenti: list[Payment]) -> Decimal:
    if len(precedenti) >= session.coperti:
        raise Conflict("Tutte le quote sono già state pagate")
    totale = totale_sessione(db, session.id)
    if totale <= 0:
        raise Conflict("Nessun ordine da pagare")
    quota = (totale / session.coperti).quantize(CENT, rounding=ROUND_DOWN)
    if quota <= 0:
        raise Conflict("Importo troppo basso per dividere alla romana")
    if len(precedenti) == session.coperti - 1:
        # L'ultimo copre la differenza di arrotondamento: la somma torna sempre al totale.
        return totale - sum((p.amount for p in precedenti), Decimal("0.00"))
    return quota


def _voci_own(
    db: Session, session: TableSession, selezione: list[tuple[int, int]]
) -> list[tuple[OrderItem, int]]:
    if not selezione:
        raise Invalid("Seleziona almeno una voce da pagare")
    richieste: dict[int, int] = {}
    for order_item_id, quantity in selezione:
        richieste[order_item_id] = richieste.get(order_item_id, 0) + quantity

    pagate = _quantita_pagate(db, session.id)
    voci = []
    for order_item_id, quantity in richieste.items():
        item = db.get(OrderItem, order_item_id)
        if item is None or item.session_id != session.id:
            raise NotFound("Ordine non trovato")
        if quantity > item.quantity - pagate.get(order_item_id, 0):
            raise Conflict("Quantità oltre il residuo da pagare")
        voci.append((item, quantity))
    return voci


def crea_pagamento(
    db: Session,
    session_id: int,
    method: PaymentMethod,
    nickname: str,
    selezione: list[tuple[int, int]] | None,
) -> Payment:
    session = _sessione_aperta(db, session_id)
    if session.payment_mode is None:
        raise Conflict("Scegli prima la modalità di pagamento")

    voci: list[tuple[OrderItem, int]] = []
    if session.payment_mode == PaymentMode.ROMANA:
        importo = _importo_romana(db, session, _pagamenti(db, session_id))
    else:
        voci = _voci_own(db, session, selezione or [])
        importo = sum((item.unit_price * qty for item, qty in voci), Decimal("0.00"))

    payment = Payment(
        session_id=session_id,
        amount=importo,
        mode=session.payment_mode,
        method=method,
        # Online è simulato (subito completato); alla cassa attende la conferma del cameriere.
        status=PaymentStatus.COMPLETED if method == PaymentMethod.ONLINE else PaymentStatus.CASH,
        customer_nickname=nickname,
    )
    db.add(payment)
    db.flush()
    for item, qty in voci:
        db.add(PaymentItem(payment_id=payment.id, order_item_id=item.id, quantity=qty))
    db.flush()

    if _tutto_coperto(db, session):
        _chiudi(session)
    return payment


def _tutto_coperto(db: Session, session: TableSession) -> bool:
    """ROMANA: tante quote quanti coperti. OWN: ogni voce ordinata è interamente pagata."""
    if session.payment_mode == PaymentMode.ROMANA:
        return len(_pagamenti(db, session.id)) >= session.coperti
    ordinate = db.scalars(select(OrderItem).where(OrderItem.session_id == session.id)).all()
    pagate = _quantita_pagate(db, session.id)
    return bool(ordinate) and all(pagate.get(i.id, 0) >= i.quantity for i in ordinate)


def conferma_contanti(db: Session, payment_id: int) -> Payment:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise NotFound("Pagamento non trovato")
    if payment.status != PaymentStatus.CASH:
        raise Conflict("Il pagamento non è in attesa alla cassa")
    payment.status = PaymentStatus.COMPLETED
    return payment


def chiudi_forzatamente(db: Session, session_id: int) -> TableSession:
    session = _blocca_sessione(db, session_id)
    if session.status != SessionStatus.OPEN:
        raise Conflict("La sessione è già chiusa")
    _chiudi(session)
    return session


def riepilogo(db: Session, session_id: int) -> tuple[list[Payment], Decimal, Decimal]:
    """Pagamenti, totale incassato/impegnato e residuo da pagare."""
    pagamenti = _pagamenti(db, session_id)
    pagato = sum((p.amount for p in pagamenti), Decimal("0.00"))
    return pagamenti, pagato, totale_sessione(db, session_id) - pagato
