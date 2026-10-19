from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import exists, select

from app.deps import AdminUser, DbSession
from app.models import MenuItem, OrderItem, Restaurant
from app.schemas import MenuItemIn, MenuItemOut

router = APIRouter(prefix="/api/menu", tags=["menu"])


def ristorante_singolo(db: DbSession) -> Restaurant:
    """Per ora l'app gestisce un solo ristorante: il primo, creato al primo piatto."""
    restaurant = db.scalar(select(Restaurant).order_by(Restaurant.id).limit(1))
    if restaurant is None:
        restaurant = Restaurant(name="Il mio ristorante")
        db.add(restaurant)
        db.flush()
    return restaurant


def _piatto_o_404(db: DbSession, item_id: int) -> MenuItem:
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Piatto non trovato")
    return item


def _elenco(db: DbSession, *, solo_disponibili: bool) -> list[MenuItem]:
    query = select(MenuItem).order_by(MenuItem.category, MenuItem.name, MenuItem.id)
    if solo_disponibili:
        query = query.where(MenuItem.available.is_(True))
    return list(db.scalars(query))


@router.get("")
def menu_pubblico(db: DbSession) -> list[MenuItemOut]:
    return [MenuItemOut.model_validate(i) for i in _elenco(db, solo_disponibili=True)]


@router.get("/all")
def menu_completo(db: DbSession, _admin: AdminUser) -> list[MenuItemOut]:
    return [MenuItemOut.model_validate(i) for i in _elenco(db, solo_disponibili=False)]


@router.post("", status_code=status.HTTP_201_CREATED)
def crea_piatto(data: MenuItemIn, db: DbSession, _admin: AdminUser) -> MenuItemOut:
    item = MenuItem(restaurant_id=ristorante_singolo(db).id, **data.model_dump())
    db.add(item)
    db.commit()
    return MenuItemOut.model_validate(item)


@router.put("/{item_id}")
def modifica_piatto(
    item_id: int, data: MenuItemIn, db: DbSession, _admin: AdminUser
) -> MenuItemOut:
    item = _piatto_o_404(db, item_id)
    for campo, valore in data.model_dump().items():
        setattr(item, campo, valore)
    db.commit()
    return MenuItemOut.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def elimina_piatto(item_id: int, db: DbSession, _admin: AdminUser) -> Response:
    item = _piatto_o_404(db, item_id)
    if db.scalar(select(exists().where(OrderItem.menu_item_id == item_id))):
        # I conti passati puntano a questo piatto: si nasconde invece di cancellarlo.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Piatto già ordinato: impostalo come non disponibile invece di eliminarlo",
        )
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
