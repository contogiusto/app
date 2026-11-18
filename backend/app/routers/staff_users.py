"""Admin di ristorante: gestione degli utenti del proprio locale (altri admin e camerieri)."""

from fastapi import APIRouter, Response, status

from app import users
from app.deps import AdminUser, DbSession, RestaurantId
from app.errors import Conflict
from app.models import UserRole
from app.schemas import PasswordIn, StaffUserIn, StaffUserOut, StaffUserPatch

router = APIRouter(prefix="/api/users", tags=["users"])

_SU_DI_SE = "Non puoi farlo su te stesso: chiedilo a un altro admin"


@router.get("")
def elenco(db: DbSession, _admin: AdminUser, restaurant_id: RestaurantId) -> list[StaffUserOut]:
    return [StaffUserOut.model_validate(u) for u in users.elenco_utenti(db, restaurant_id)]


@router.post("", status_code=status.HTTP_201_CREATED)
def crea(
    data: StaffUserIn, db: DbSession, _admin: AdminUser, restaurant_id: RestaurantId
) -> StaffUserOut:
    user = users.crea_utente(db, restaurant_id, data.username, UserRole(data.role), data.password)
    db.commit()
    return StaffUserOut.model_validate(user)


@router.patch("/{user_id}")
def modifica(
    user_id: int,
    data: StaffUserPatch,
    db: DbSession,
    admin: AdminUser,
    restaurant_id: RestaurantId,
) -> StaffUserOut:
    user = users.utente_del_ristorante(db, restaurant_id, user_id)
    if user.id == admin.id and (data.active is False or data.role is not None):
        raise Conflict(_SU_DI_SE)
    if data.role is not None:
        users.cambia_ruolo(db, user, UserRole(data.role))
    if data.active is not None:
        users.imposta_attivo(db, user, data.active)
    db.commit()
    return StaffUserOut.model_validate(user)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reimposta_password(
    user_id: int,
    data: PasswordIn,
    db: DbSession,
    admin: AdminUser,
    restaurant_id: RestaurantId,
) -> Response:
    user = users.utente_del_ristorante(db, restaurant_id, user_id)
    if user.id == admin.id:
        # La propria password si cambia da /api/auth/change-password (chiede quella attuale).
        raise Conflict(_SU_DI_SE)
    users.reimposta_password(db, user, data.password)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def elimina(user_id: int, db: DbSession, admin: AdminUser, restaurant_id: RestaurantId) -> Response:
    user = users.utente_del_ristorante(db, restaurant_id, user_id)
    if user.id == admin.id:
        raise Conflict(_SU_DI_SE)
    users.elimina_utente(db, user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
