from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import DbSession, StaffUser
from app.models import RestaurantTable, SessionStatus, TableSession
from app.routers.orders import totale_sessione
from app.schemas import SessionIn, SessionOut

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


@router.get("/{session_id}")
def leggi_sessione(session_id: int, db: DbSession, _staff: StaffUser) -> SessionOut:
    session = db.get(TableSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sessione non trovata")
    return esito_sessione(db, session)
