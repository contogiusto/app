from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.deps import AdminUser, DbSession, RestaurantId, StaffUser
from app.models import MenuItem, OrderItem
from app.schemas import MenuItemIn, MenuItemOut

router = APIRouter(prefix="/api/menu", tags=["menu"])


def _piatto_o_404(db: DbSession, item_id: int, restaurant_id: int) -> MenuItem:
    item = db.get(MenuItem, item_id)
    if item is None or item.restaurant_id != restaurant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piatto non trovato")
    return item


def elenco_menu(db: Session, restaurant_id: int, *, solo_disponibili: bool) -> list[MenuItem]:
    query = (
        select(MenuItem)
        .where(MenuItem.restaurant_id == restaurant_id)
        .order_by(MenuItem.category, MenuItem.name, MenuItem.id)
    )
    if solo_disponibili:
        query = query.where(MenuItem.available.is_(True))
    return list(db.scalars(query))


@router.get("")
def menu_disponibile(
    db: DbSession, _staff: StaffUser, restaurant_id: RestaurantId
) -> list[MenuItemOut]:
    """Piatti disponibili del ristorante dell'utente (il menu per i clienti è sotto /api/public)."""
    piatti = elenco_menu(db, restaurant_id, solo_disponibili=True)
    return [MenuItemOut.model_validate(i) for i in piatti]


@router.get("/all")
def menu_completo(
    db: DbSession, _admin: AdminUser, restaurant_id: RestaurantId
) -> list[MenuItemOut]:
    piatti = elenco_menu(db, restaurant_id, solo_disponibili=False)
    return [MenuItemOut.model_validate(i) for i in piatti]


@router.post("", status_code=status.HTTP_201_CREATED)
def crea_piatto(
    data: MenuItemIn, db: DbSession, _admin: AdminUser, restaurant_id: RestaurantId
) -> MenuItemOut:
    item = MenuItem(restaurant_id=restaurant_id, **data.model_dump())
    db.add(item)
    db.commit()
    return MenuItemOut.model_validate(item)


@router.put("/{item_id}")
def modifica_piatto(
    item_id: int, data: MenuItemIn, db: DbSession, _admin: AdminUser, restaurant_id: RestaurantId
) -> MenuItemOut:
    item = _piatto_o_404(db, item_id, restaurant_id)
    for campo, valore in data.model_dump().items():
        setattr(item, campo, valore)
    db.commit()
    return MenuItemOut.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def elimina_piatto(
    item_id: int, db: DbSession, _admin: AdminUser, restaurant_id: RestaurantId
) -> Response:
    item = _piatto_o_404(db, item_id, restaurant_id)
    if db.scalar(select(exists().where(OrderItem.menu_item_id == item_id))):
        # I conti passati puntano a questo piatto: si nasconde invece di cancellarlo.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Piatto già ordinato: impostalo come non disponibile invece di eliminarlo",
        )
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
