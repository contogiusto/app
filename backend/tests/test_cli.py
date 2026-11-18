import pytest
from sqlalchemy import select

from app.cli import (
    create_restaurant,
    create_user,
    list_users,
    main,
    promote_superadmin,
    reset_password,
)
from app.models import AppUser, Restaurant, UserRole
from app.security import verify_password

PW = "una-password-lunga-12"


@pytest.fixture
def gino(db):
    return create_restaurant(db, "da-gino", "Da Gino")


@pytest.fixture
def lia(db):
    return create_restaurant(db, "da-lia", "Da Lia")


# ---------- ristoranti ----------


def test_crea_ristorante(db):
    r = create_restaurant(db, "da-gino", "  Da Gino ")
    assert (r.slug, r.name, r.active) == ("da-gino", "Da Gino", True)


@pytest.mark.parametrize("slug", ["Da Gino", "ab", "admin", "-x-"])
def test_crea_ristorante_rifiuta_slug_non_valido(db, slug):
    with pytest.raises(ValueError, match="non valido"):
        create_restaurant(db, slug, "X")


def test_crea_ristorante_rifiuta_slug_gia_usato(db, gino):
    with pytest.raises(ValueError, match="già un ristorante"):
        create_restaurant(db, "da-gino", "Altro")


# ---------- creazione utenti ----------


def test_crea_utente_con_password_hashata(db, gino):
    user = create_user(db, "admin", UserRole.ADMIN, PW, gino)
    saved = db.scalar(select(AppUser).where(AppUser.username == "admin"))
    assert saved.id == user.id and saved.restaurant_id == gino.id
    assert saved.password_hash != PW
    assert verify_password(PW, saved.password_hash)


def test_rifiuta_password_corta(db, gino):
    with pytest.raises(ValueError, match="almeno 12"):
        create_user(db, "admin", UserRole.ADMIN, "corta", gino)


def test_staff_richiede_un_ristorante(db):
    with pytest.raises(ValueError, match="indica --restaurant"):
        create_user(db, "mario", UserRole.WAITER, PW)


def test_superadmin_non_ha_ristorante(db, gino):
    with pytest.raises(ValueError, match="non appartiene"):
        create_user(db, "capo", UserRole.SUPERADMIN, PW, gino)
    capo = create_user(db, "capo", UserRole.SUPERADMIN, PW)
    assert capo.restaurant_id is None


def test_stesso_username_in_ristoranti_diversi_ma_non_nello_stesso(db, gino, lia):
    create_user(db, "mario", UserRole.WAITER, PW, gino)
    create_user(db, "mario", UserRole.WAITER, PW, lia)
    with pytest.raises(ValueError, match="già esiste"):
        create_user(db, "mario", UserRole.ADMIN, PW, gino)


def test_username_unico_tra_gli_admin_centrali(db):
    create_user(db, "capo", UserRole.SUPERADMIN, PW)
    with pytest.raises(ValueError, match="già esiste"):
        create_user(db, "capo", UserRole.SUPERADMIN, PW)


# ---------- promozione ----------


def test_promuove_ad_admin_centrale(db, gino):
    user = create_user(db, "mario", UserRole.ADMIN, PW, gino)
    promote_superadmin(db, "mario")
    db.refresh(user)
    assert user.role == UserRole.SUPERADMIN and user.restaurant_id is None


def test_promozione_ambigua_chiede_il_ristorante(db, gino, lia):
    create_user(db, "mario", UserRole.ADMIN, PW, gino)
    create_user(db, "mario", UserRole.ADMIN, PW, lia)
    with pytest.raises(ValueError, match="indica --restaurant"):
        promote_superadmin(db, "mario")
    assert promote_superadmin(db, "mario", "da-lia").role == UserRole.SUPERADMIN


def test_promozione_rifiuta_inesistente_e_gia_centrale(db):
    with pytest.raises(ValueError, match="non esiste"):
        promote_superadmin(db, "nessuno")
    create_user(db, "capo", UserRole.SUPERADMIN, PW)
    with pytest.raises(ValueError, match="non esiste"):
        promote_superadmin(db, "capo")  # solo SUPERADMIN: nessun candidato staff


def test_promozione_rifiuta_se_esiste_un_centrale_omonimo(db, gino):
    create_user(db, "mario", UserRole.SUPERADMIN, PW)
    create_user(db, "mario", UserRole.ADMIN, PW, gino)
    with pytest.raises(ValueError, match="già un admin centrale"):
        promote_superadmin(db, "mario")


# ---------- elenco ----------


def test_elenca_utenti_ordinati_senza_hash(db, gino, lia):
    create_user(db, "zeta", UserRole.WAITER, PW, lia)
    create_user(db, "alfa", UserRole.ADMIN, PW, gino)
    create_user(db, "capo", UserRole.SUPERADMIN, PW)
    rows = list_users(db)
    assert [(r.username, r.role, r.restaurant) for r in rows] == [
        ("capo", UserRole.SUPERADMIN, None),
        ("alfa", UserRole.ADMIN, "da-gino"),
        ("zeta", UserRole.WAITER, "da-lia"),
    ]


# ---------- reset password ----------


def test_reset_password_cambia_solo_la_password(db, gino):
    user = create_user(db, "mario", UserRole.WAITER, "vecchia-password-12", gino)
    reset_password(db, "mario", "nuova-password-lunga-12")
    db.refresh(user)
    assert verify_password("nuova-password-lunga-12", user.password_hash)
    assert not verify_password("vecchia-password-12", user.password_hash)
    assert user.role == UserRole.WAITER


def test_reset_password_con_ristorante_sceglie_l_utente_giusto(db, gino, lia):
    a = create_user(db, "mario", UserRole.WAITER, "password-gino-12", gino)
    b = create_user(db, "mario", UserRole.WAITER, "password-lia-123", lia)
    with pytest.raises(ValueError, match="indica --restaurant"):
        reset_password(db, "mario", "nuova-password-lunga-12")
    reset_password(db, "mario", "nuova-password-lunga-12", "da-lia")
    db.refresh(a)
    db.refresh(b)
    assert verify_password("password-gino-12", a.password_hash)
    assert verify_password("nuova-password-lunga-12", b.password_hash)


def test_reset_password_rifiuta_utente_inesistente(db):
    with pytest.raises(ValueError, match="non esiste"):
        reset_password(db, "nessuno", "nuova-password-lunga-12")


def test_reset_password_rifiuta_password_corta(db, gino):
    create_user(db, "mario", UserRole.WAITER, "vecchia-password-12", gino)
    with pytest.raises(ValueError, match="almeno 12"):
        reset_password(db, "mario", "corta")


# ---------- main ----------


class _Ctx:
    def __init__(self, session):
        self.session = session

    def __enter__(self):
        return self.session

    def __exit__(self, *exc):
        return False


def test_main_list_users_stampa_utenti(capsys, monkeypatch, db, gino):
    create_user(db, "mario", UserRole.WAITER, PW, gino)
    db.commit = lambda: None  # la sessione di test resta annullabile
    monkeypatch.setattr("app.cli.SessionLocal", lambda: _Ctx(db))
    assert main(["list-users"]) == 0
    out = capsys.readouterr().out
    assert "mario" in out and "WAITER" in out and "da-gino" in out
    assert "argon2" not in out


def test_main_crea_ristorante_e_promuove(capsys, monkeypatch, db, gino):
    create_user(db, "mario", UserRole.ADMIN, PW, gino)
    db.commit = lambda: None
    monkeypatch.setattr("app.cli.SessionLocal", lambda: _Ctx(db))
    assert main(["create-restaurant", "da-lia", "Da Lia"]) == 0
    assert db.scalar(select(Restaurant).where(Restaurant.slug == "da-lia")) is not None
    assert main(["promote-superadmin", "mario"]) == 0
    assert "admin centrale" in capsys.readouterr().out
    assert main(["promote-superadmin", "mario"]) == 1
