"""multi ristorante: slug, utenti per ristorante (fase "espandi")

Compatibile con la versione di codice precedente (ADR 0002): colonne nuove nullable o con
default, ruolo SUPERADMIN aggiunto ma non assegnato a nessuno (si promuove a deploy finito con
`python -m app.cli promote-superadmin`). Gli utenti esistenti vengono legati al primo ristorante.

Revision ID: 1c92864381ed
Revises: 394506211319
Create Date: 2026-11-18 21:00:00
"""

import re
import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "1c92864381ed"
down_revision = "394506211319"
branch_labels = None
depends_on = None

_RISERVATI = {
    "api", "admin", "waiter", "staff", "customer", "table", "tavolo", "privacy", "piattaforma",
    "platform", "ristorante", "ristoranti", "login", "accesso", "reset-password", "assets",
}  # fmt: skip


def _slug(nome: str, id_: int, usati: set[str]) -> str:
    ascii_nome = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z0-9]+", "-", ascii_nome.lower()).strip("-")[:34].strip("-")
    if len(base) < 3 or base in _RISERVATI:
        base = "ristorante"
    slug = base
    if slug in usati or slug in _RISERVATI:
        slug = f"{base}-{id_}"
    usati.add(slug)
    return slug


def _ruoli(valori: tuple[str, ...]) -> sa.CheckConstraint:
    elenco = ", ".join(f"'{v}'" for v in valori)
    return sa.CheckConstraint(f"role IN ({elenco})", name="user_role")


def upgrade() -> None:
    # --- restaurant ---
    op.add_column("restaurant", sa.Column("slug", sa.String(length=40), nullable=True))
    op.add_column(
        "restaurant",
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        "restaurant",
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    conn = op.get_bind()
    usati: set[str] = set()
    for id_, nome in conn.execute(sa.text("SELECT id, name FROM restaurant ORDER BY id")).all():
        conn.execute(
            sa.text("UPDATE restaurant SET slug = :slug WHERE id = :id"),
            {"slug": _slug(nome, id_, usati), "id": id_},
        )
    op.create_unique_constraint("uq_restaurant_slug", "restaurant", ["slug"])

    # --- app_user ---
    op.add_column("app_user", sa.Column("restaurant_id", sa.Integer(), nullable=True))
    op.add_column(
        "app_user",
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        "app_user",
        sa.Column("must_change_password", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_foreign_key(
        "fk_app_user_restaurant_id", "app_user", "restaurant", ["restaurant_id"], ["id"]
    )
    op.create_index("ix_app_user_restaurant_id", "app_user", ["restaurant_id"])
    # Gli utenti esistenti appartengono all'unico ristorante che c'era (se c'è).
    conn.execute(
        sa.text(
            "UPDATE app_user SET restaurant_id = (SELECT id FROM restaurant ORDER BY id LIMIT 1)"
        )
    )
    # Lo username era unico in tutta l'app: ora lo è per ristorante (e tra gli utenti senza).
    op.drop_constraint("app_user_username_key", "app_user", type_="unique")
    op.create_unique_constraint(
        "uq_app_user_restaurant_username", "app_user", ["restaurant_id", "username"]
    )
    op.create_index(
        "uq_app_user_platform_username",
        "app_user",
        ["username"],
        unique=True,
        postgresql_where=sa.text("restaurant_id IS NULL"),
    )
    # Ruolo SUPERADMIN ammesso (il CHECK nasce da Enum non nativo: lo si ricrea).
    op.drop_constraint("user_role", "app_user", type_="check")
    op.create_check_constraint(
        "user_role", "app_user", _ruoli(("SUPERADMIN", "ADMIN", "WAITER")).sqltext
    )


def downgrade() -> None:
    op.drop_constraint("user_role", "app_user", type_="check")
    op.execute("DELETE FROM app_user WHERE role = 'SUPERADMIN'")
    op.create_check_constraint("user_role", "app_user", _ruoli(("ADMIN", "WAITER")).sqltext)
    op.drop_index("uq_app_user_platform_username", table_name="app_user")
    op.drop_constraint("uq_app_user_restaurant_username", "app_user", type_="unique")
    op.create_unique_constraint("app_user_username_key", "app_user", ["username"])
    op.drop_index("ix_app_user_restaurant_id", table_name="app_user")
    op.drop_constraint("fk_app_user_restaurant_id", "app_user", type_="foreignkey")
    op.drop_column("app_user", "must_change_password")
    op.drop_column("app_user", "active")
    op.drop_column("app_user", "restaurant_id")
    op.drop_constraint("uq_restaurant_slug", "restaurant", type_="unique")
    op.drop_column("restaurant", "created_at")
    op.drop_column("restaurant", "active")
    op.drop_column("restaurant", "slug")
