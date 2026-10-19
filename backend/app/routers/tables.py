import io
import secrets

import segno
from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.deps import AdminUser, DbSession, StaffUser
from app.models import RestaurantTable, SessionStatus, TableSession
from app.routers.menu import ristorante_singolo
from app.schemas import TableIn, TableOut

router = APIRouter(prefix="/api/tables", tags=["tables"])


def qr_url(table: RestaurantTable) -> str:
    """Indirizzo della pagina cliente che il QR del tavolo deve aprire."""
    return f"{settings.frontend_url}/table/{table.id}?token={table.qr_token}"


def _nuovo_token() -> str:
    return secrets.token_urlsafe(16)


def _tavolo_o_404(db: DbSession, table_id: int) -> RestaurantTable:
    table = db.get(RestaurantTable, table_id)
    if table is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tavolo non trovato")
    return table


@router.get("")
def elenco_tavoli(db: DbSession, _staff: StaffUser) -> list[TableOut]:
    tavoli = db.scalars(select(RestaurantTable).order_by(RestaurantTable.number))
    aperte = dict(
        db.execute(
            select(TableSession.table_id, TableSession.id).where(
                TableSession.status == SessionStatus.OPEN
            )
        ).all()
    )
    return [TableOut(id=t.id, number=t.number, open_session_id=aperte.get(t.id)) for t in tavoli]


@router.post("", status_code=status.HTTP_201_CREATED)
def crea_tavolo(data: TableIn, db: DbSession, _admin: AdminUser) -> TableOut:
    table = RestaurantTable(
        restaurant_id=ristorante_singolo(db).id, number=data.number, qr_token=_nuovo_token()
    )
    db.add(table)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Esiste già un tavolo con questo numero"
        ) from None
    return TableOut(id=table.id, number=table.number, open_session_id=None)


@router.post("/{table_id}/qr/regenerate", status_code=status.HTTP_204_NO_CONTENT)
def rigenera_qr(table_id: int, db: DbSession, _admin: AdminUser) -> Response:
    """Invalida il vecchio QR (es. foto diffusa fuori dal locale) e ne attiva uno nuovo."""
    _tavolo_o_404(db, table_id).qr_token = _nuovo_token()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{table_id}/qr.svg")
def qr_svg(table_id: int, db: DbSession, _admin: AdminUser) -> Response:
    table = _tavolo_o_404(db, table_id)
    # `save(kind="svg")` produce un file SVG completo (con xmlns); `svg_inline` è pensato per
    # essere incollato in una pagina HTML e, servito come immagine, il browser non lo disegna.
    buffer = io.BytesIO()
    segno.make(qr_url(table), error="m").save(buffer, kind="svg", scale=8, border=2)
    return Response(content=buffer.getvalue(), media_type="image/svg+xml")
