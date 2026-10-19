from decimal import Decimal

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.deps import DbSession, StaffUser
from app.models import MenuItem, OrderItem, Payment, PaymentItem, SessionStatus, TableSession
from app.schemas import OrderIn, OrderItemOut, OrderListOut

router = APIRouter(prefix="/api/sessions/{session_id}/orders", tags=["orders"])


def _riga(item: OrderItem) -> OrderItemOut:
    return OrderItemOut(
        id=item.id,
        menu_item_id=item.menu_item_id,
        name=item.menu_item.name,
        quantity=item.quantity,
        unit_price=item.unit_price,
        line_total=item.unit_price * item.quantity,
    )


def totale_sessione(db: Session, session_id: int) -> Decimal:
    """Somma dei prezzi congelati all'ordine (quantità × prezzo unitario)."""
    items = db.scalars(select(OrderItem).where(OrderItem.session_id == session_id))
    return sum((i.unit_price * i.quantity for i in items), Decimal("0.00"))


def _sessione_o_404(db: Session, session_id: int) -> TableSession:
    session = db.get(TableSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sessione non trovata")
    return session


def _sessione_modificabile(db: Session, session_id: int) -> TableSession:
    """Gli ordini si cambiano solo a sessione aperta e prima del primo pagamento."""
    session = _sessione_o_404(db, session_id)
    if session.status != SessionStatus.OPEN:
        raise HTTPException(status.HTTP_409_CONFLICT, "La sessione è chiusa")
    if db.scalar(select(exists().where(Payment.session_id == session_id))):
        # Cambiare il conto dopo che qualcuno ha pagato falserebbe le quote già versate.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ci sono già pagamenti: gli ordini non si possono più modificare",
        )
    return session


@router.get("")
def elenco_ordini(session_id: int, db: DbSession, _staff: StaffUser) -> OrderListOut:
    _sessione_o_404(db, session_id)
    items = db.scalars(
        select(OrderItem).where(OrderItem.session_id == session_id).order_by(OrderItem.id)
    ).all()
    return OrderListOut(items=[_riga(i) for i in items], total=totale_sessione(db, session_id))


@router.post("", status_code=status.HTTP_201_CREATED)
def aggiungi_ordine(
    session_id: int, data: OrderIn, db: DbSession, staff: StaffUser
) -> OrderItemOut:
    _sessione_modificabile(db, session_id)
    piatto = db.get(MenuItem, data.menu_item_id)
    if piatto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piatto non trovato")
    if not piatto.available:
        raise HTTPException(status.HTTP_409_CONFLICT, "Piatto non disponibile")

    item = OrderItem(
        session_id=session_id,
        menu_item_id=piatto.id,
        quantity=data.quantity,
        unit_price=piatto.price,  # congelato: un cambio di menu non altera il conto
        added_by=staff.id,
    )
    db.add(item)
    db.commit()
    return _riga(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def rimuovi_ordine(session_id: int, item_id: int, db: DbSession, _staff: StaffUser) -> Response:
    _sessione_modificabile(db, session_id)
    item = db.get(OrderItem, item_id)
    if item is None or item.session_id != session_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ordine non trovato")
    if db.scalar(select(exists().where(PaymentItem.order_item_id == item_id))):
        raise HTTPException(status.HTTP_409_CONFLICT, "La voce è già stata pagata")
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
