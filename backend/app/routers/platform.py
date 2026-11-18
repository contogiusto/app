"""Admin centrale (SUPERADMIN): ristoranti e utenti dei ristoranti. Non tocca i loro dati."""

from fastapi import APIRouter, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app import users
from app.deps import DbSession, PlatformUser
from app.errors import Conflict, NotFound
from app.models import AppUser, Restaurant, UserRole
from app.schemas import (
    PasswordIn,
    RestaurantIn,
    RestaurantOut,
    RestaurantPatch,
    StaffUserIn,
    StaffUserOut,
    StaffUserPatch,
)

router = APIRouter(prefix="/api/platform", tags=["platform"])

_SLUG_IN_USO = "Questo indirizzo è già usato da un altro ristorante"


def _out(db: DbSession, r: Restaurant) -> RestaurantOut:
    utenti = db.scalar(select(func.count()).where(AppUser.restaurant_id == r.id)) or 0
    return RestaurantOut(
        id=r.id,
        name=r.name,
        slug=r.slug,
        active=r.active,
        created_at=r.created_at,
        users=utenti,
    )


def _ristorante_o_404(db: DbSession, restaurant_id: int) -> Restaurant:
    r = db.get(Restaurant, restaurant_id)
    if r is None:
        raise NotFound("Ristorante non trovato")
    return r


def _slug_libero(db: DbSession, slug: str, escludi_id: int | None = None) -> None:
    altro = db.scalar(select(Restaurant.id).where(Restaurant.slug == slug))
    if altro is not None and altro != escludi_id:
        raise Conflict(_SLUG_IN_USO)


@router.get("/restaurants")
def elenco_ristoranti(db: DbSession, _admin: PlatformUser) -> list[RestaurantOut]:
    return [_out(db, r) for r in db.scalars(select(Restaurant).order_by(Restaurant.name))]


@router.post("/restaurants", status_code=status.HTTP_201_CREATED)
def crea_ristorante(data: RestaurantIn, db: DbSession, _admin: PlatformUser) -> RestaurantOut:
    _slug_libero(db, data.slug)
    r = Restaurant(name=data.name, slug=data.slug)
    db.add(r)
    try:
        db.commit()
    except IntegrityError:  # due richieste insieme con lo stesso indirizzo
        db.rollback()
        raise Conflict(_SLUG_IN_USO) from None
    return _out(db, r)


@router.patch("/restaurants/{restaurant_id}")
def modifica_ristorante(
    restaurant_id: int, data: RestaurantPatch, db: DbSession, _admin: PlatformUser
) -> RestaurantOut:
    r = _ristorante_o_404(db, restaurant_id)
    if data.name is not None:
        r.name = data.name
    if data.slug is not None:
        _slug_libero(db, data.slug, escludi_id=r.id)
        r.slug = data.slug
    if data.active is not None:
        r.active = data.active
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise Conflict(_SLUG_IN_USO) from None
    return _out(db, r)


@router.get("/restaurants/{restaurant_id}/users")
def utenti_del_ristorante(
    restaurant_id: int, db: DbSession, _admin: PlatformUser
) -> list[StaffUserOut]:
    _ristorante_o_404(db, restaurant_id)
    return [StaffUserOut.model_validate(u) for u in users.elenco_utenti(db, restaurant_id)]


@router.post("/restaurants/{restaurant_id}/users", status_code=status.HTTP_201_CREATED)
def crea_utente(
    restaurant_id: int, data: StaffUserIn, db: DbSession, _admin: PlatformUser
) -> StaffUserOut:
    _ristorante_o_404(db, restaurant_id)
    user = users.crea_utente(db, restaurant_id, data.username, UserRole(data.role), data.password)
    db.commit()
    return StaffUserOut.model_validate(user)


@router.patch("/restaurants/{restaurant_id}/users/{user_id}")
def modifica_utente(
    restaurant_id: int, user_id: int, data: StaffUserPatch, db: DbSession, _admin: PlatformUser
) -> StaffUserOut:
    user = users.utente_del_ristorante(db, restaurant_id, user_id)
    if data.role is not None:
        users.cambia_ruolo(db, user, UserRole(data.role))
    if data.active is not None:
        users.imposta_attivo(db, user, data.active)
    db.commit()
    return StaffUserOut.model_validate(user)


@router.post(
    "/restaurants/{restaurant_id}/users/{user_id}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
)
def reimposta_password(
    restaurant_id: int, user_id: int, data: PasswordIn, db: DbSession, _admin: PlatformUser
) -> Response:
    user = users.utente_del_ristorante(db, restaurant_id, user_id)
    users.reimposta_password(db, user, data.password)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/restaurants/{restaurant_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
def elimina_utente(
    restaurant_id: int, user_id: int, db: DbSession, _admin: PlatformUser
) -> Response:
    user = users.utente_del_ristorante(db, restaurant_id, user_id)
    users.elimina_utente(db, user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
