"""Endpoint per i clienti al tavolo: si accede col token del QR, senza account.

Il token viaggia nell'header `X-Table-Token` (non nell'URL, per tenerlo fuori dai log di
accesso). Qualunque problema di accesso — tavolo inesistente, token sbagliato o assente —
dà la stessa risposta 404, così non si può scoprire quali tavoli esistono.

Rate limit (app/ratelimit.py): gli accessi con token errato si contano per IP e, esaurito il
limite, tutto da quell'IP dà 429 senza nemmeno guardare il token; le richieste valide si
contano per tavolo (polling incluso) e le scritture hanno un limite più stretto.
"""

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import payments, ratelimit
from app.config import settings
from app.deps import DbSession, OptionalCustomer
from app.errors import Conflict, NotFound
from app.models import OrderItem, Restaurant, RestaurantTable, SessionStatus, TableSession
from app.routers.orders import totale_sessione
from app.schemas import (
    ModeIn,
    PaymentIn,
    PaymentOut,
    PublicOrderItemOut,
    PublicPaymentOut,
    PublicSessionOut,
    PublicTableOut,
)

router = APIRouter(prefix="/api/public/tables/{table_id}", tags=["public"])


def _tavolo_dal_qr(
    table_id: int,
    request: Request,
    db: DbSession,
    x_table_token: Annotated[str | None, Header()] = None,
) -> RestaurantTable:
    chiave_ip = (
        f"pub-fail:{ratelimit.ip_client(request.headers, request.client and request.client.host)}"
    )
    finestra = settings.rate_limit_public_fail_window
    ratelimit.verifica(chiave_ip, settings.rate_limit_public_fail_max, finestra)

    table = db.get(RestaurantTable, table_id)
    token = x_table_token or ""
    # Confronto a tempo costante; se il tavolo non esiste si confronta comunque con un valore finto.
    atteso = table.qr_token if table else secrets.token_urlsafe(16)
    if table is None or not secrets.compare_digest(token.encode(), atteso.encode()):
        ratelimit.colpisci(chiave_ip, settings.rate_limit_public_fail_max, finestra)
        raise NotFound("Tavolo non trovato")

    ratelimit.colpisci(
        f"pub-table:{table.id}",
        settings.rate_limit_public_table_max,
        settings.rate_limit_public_table_window,
    )
    return table


Tavolo = Annotated[RestaurantTable, Depends(_tavolo_dal_qr)]


def _tavolo_per_scrittura(table: Tavolo) -> RestaurantTable:
    ratelimit.colpisci(
        f"pub-write:{table.id}",
        settings.rate_limit_public_write_max,
        settings.rate_limit_public_write_window,
    )
    return table


TavoloScrittura = Annotated[RestaurantTable, Depends(_tavolo_per_scrittura)]


def _sessione_aperta(db: Session, table: RestaurantTable) -> TableSession | None:
    return db.scalar(
        select(TableSession).where(
            TableSession.table_id == table.id, TableSession.status == SessionStatus.OPEN
        )
    )


def _vista(db: Session, table: RestaurantTable) -> PublicTableOut:
    session = _sessione_aperta(db, table)
    restaurant_name = db.get(Restaurant, table.restaurant_id).name
    if session is None:
        return PublicTableOut(
            restaurant_name=restaurant_name, table_number=table.number, session=None
        )

    righe = db.scalars(
        select(OrderItem).where(OrderItem.session_id == session.id).order_by(OrderItem.id)
    ).all()
    pagate = payments.quantita_pagate(db, session.id)
    pagamenti, pagato, residuo = payments.riepilogo(db, session.id)
    return PublicTableOut(
        restaurant_name=restaurant_name,
        table_number=table.number,
        session=PublicSessionOut(
            id=session.id,
            status=session.status,
            coperti=session.coperti,
            payment_mode=session.payment_mode,
            total=totale_sessione(db, session.id),
            paid_total=pagato,
            remaining=residuo,
            next_share=payments.prossima_quota(db, session),
            items=[
                PublicOrderItemOut(
                    id=r.id,
                    name=r.menu_item.name,
                    category=r.menu_item.category,
                    quantity=r.quantity,
                    unit_price=r.unit_price,
                    line_total=r.unit_price * r.quantity,
                    paid_quantity=pagate.get(r.id, 0),
                )
                for r in righe
            ],
            payments=[PublicPaymentOut.model_validate(p) for p in pagamenti],
        ),
    )


def _id_sessione_aperta(db: Session, table: RestaurantTable) -> int:
    session = _sessione_aperta(db, table)
    if session is None:
        raise Conflict("Nessuna sessione aperta per questo tavolo")
    return session.id


@router.get("")
def vista_tavolo(table: Tavolo, db: DbSession) -> PublicTableOut:
    return _vista(db, table)


@router.put("/mode")
def scegli_modalita(table: TavoloScrittura, data: ModeIn, db: DbSession) -> PublicTableOut:
    payments.imposta_modalita(db, _id_sessione_aperta(db, table), data.payment_mode)
    db.commit()
    return _vista(db, table)


@router.post("/payments", status_code=status.HTTP_201_CREATED)
def paga(
    table: TavoloScrittura, data: PaymentIn, db: DbSession, customer: OptionalCustomer
) -> PaymentOut:
    """Con un token cliente valido il pagamento finisce nel suo storico; senza (o con un token
    scaduto o non valido) si paga come ospite: al tavolo un problema di login non blocca nulla."""
    selezione = (
        [(i.order_item_id, i.quantity) for i in data.items] if data.items is not None else None
    )
    payment = payments.crea_pagamento(
        db,
        _id_sessione_aperta(db, table),
        data.method,
        data.customer_nickname,
        selezione,
        customer_id=customer.id if customer else None,
    )
    db.commit()
    return PaymentOut.model_validate(payment)
