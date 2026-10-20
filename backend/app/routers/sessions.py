from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import DbSession, StaffUser
from app.models import (
    OrderItem,
    Payment,
    PaymentStatus,
    RestaurantTable,
    SessionStatus,
    TableSession,
)
from app.routers.orders import totale_sessione
from app.schemas import OpenSessionOut, SessionIn, SessionOut

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

_GIA_APERTA = "Il tavolo ha già una sessione aperta"


def esito_sessione(db: Session, session: TableSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        table_id=session.table_id,
        status=session.status,
        coperti=session.coperti,
        payment_mode=session.payment_mode,
        total=totale_sessione(db, session.id),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def apri_sessione(data: SessionIn, db: DbSession, _staff: StaffUser) -> SessionOut:
    if db.get(RestaurantTable, data.table_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tavolo non trovato")
    aperta = db.scalar(
        select(TableSession.id).where(
            TableSession.table_id == data.table_id, TableSession.status == SessionStatus.OPEN
        )
    )
    if aperta is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, _GIA_APERTA)

    session = TableSession(table_id=data.table_id, coperti=data.coperti)
    db.add(session)
    try:
        db.commit()
    except IntegrityError:
        # Due camerieri hanno aperto lo stesso tavolo nello stesso istante: vince il primo.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, _GIA_APERTA) from None
    return esito_sessione(db, session)


@router.get("/open")
def sessioni_aperte(db: DbSession, _staff: StaffUser) -> list[OpenSessionOut]:
    """Tutte le sessioni aperte in una sola richiesta: evita di interrogarle una a una."""
    totali = dict(
        db.execute(
            select(
                OrderItem.session_id, func.sum(OrderItem.unit_price * OrderItem.quantity)
            ).group_by(OrderItem.session_id)
        ).all()
    )
    pagamenti = {
        sid: (pagato, contanti)
        for sid, pagato, contanti in db.execute(
            select(
                Payment.session_id,
                func.sum(Payment.amount),
                func.count().filter(Payment.status == PaymentStatus.CASH),
            ).group_by(Payment.session_id)
        ).all()
    }
    aperte = db.scalars(
        select(TableSession)
        .where(TableSession.status == SessionStatus.OPEN)
        .order_by(TableSession.id)
    )
    zero = Decimal("0.00")
    return [
        OpenSessionOut(
            id=s.id,
            table_id=s.table_id,
            coperti=s.coperti,
            payment_mode=s.payment_mode,
            total=totali.get(s.id, zero),
            paid_total=pagamenti.get(s.id, (zero, 0))[0],
            cash_pending=pagamenti.get(s.id, (zero, 0))[1],
        )
        for s in aperte
    ]


@router.get("/{session_id}")
def leggi_sessione(session_id: int, db: DbSession, _staff: StaffUser) -> SessionOut:
    session = db.get(TableSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sessione non trovata")
    return esito_sessione(db, session)
