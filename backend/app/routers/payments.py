from fastapi import APIRouter, status

from app import payments
from app.deps import DbSession, StaffUser
from app.errors import NotFound
from app.models import TableSession
from app.routers.sessions import esito_sessione
from app.schemas import ModeIn, PaymentIn, PaymentListOut, PaymentOut, SessionOut

router = APIRouter(prefix="/api", tags=["payments"])


@router.put("/sessions/{session_id}/mode")
def imposta_modalita(session_id: int, data: ModeIn, db: DbSession, _staff: StaffUser) -> SessionOut:
    session = payments.imposta_modalita(db, session_id, data.payment_mode)
    db.commit()
    return esito_sessione(db, session)


@router.post("/sessions/{session_id}/payments", status_code=status.HTTP_201_CREATED)
def crea_pagamento(
    session_id: int, data: PaymentIn, db: DbSession, _staff: StaffUser
) -> PaymentOut:
    selezione = (
        [(i.order_item_id, i.quantity) for i in data.items] if data.items is not None else None
    )
    payment = payments.crea_pagamento(
        db, session_id, data.method, data.customer_nickname, selezione
    )
    db.commit()
    return PaymentOut.model_validate(payment)


@router.get("/sessions/{session_id}/payments")
def elenco_pagamenti(session_id: int, db: DbSession, _staff: StaffUser) -> PaymentListOut:
    if db.get(TableSession, session_id) is None:
        raise NotFound("Sessione non trovata")
    pagamenti, pagato, residuo = payments.riepilogo(db, session_id)
    return PaymentListOut(
        items=[PaymentOut.model_validate(p) for p in pagamenti],
        paid_total=pagato,
        remaining=residuo,
    )


@router.put("/payments/{payment_id}/confirm")
def conferma_contanti(payment_id: int, db: DbSession, _staff: StaffUser) -> PaymentOut:
    payment = payments.conferma_contanti(db, payment_id)
    db.commit()
    return PaymentOut.model_validate(payment)


@router.post("/sessions/{session_id}/close")
def chiudi_sessione(session_id: int, db: DbSession, _staff: StaffUser) -> SessionOut:
    session = payments.chiudi_forzatamente(db, session_id)
    db.commit()
    return esito_sessione(db, session)
