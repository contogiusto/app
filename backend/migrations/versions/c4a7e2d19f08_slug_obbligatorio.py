"""ristoranti: slug obbligatorio (fase "restringi")

Tutti i ristoranti hanno già lo slug (assegnato dalla migration 1c92864381ed o scelto alla
creazione): qui diventa NOT NULL. Per sicurezza chi fosse rimasto senza ne riceve uno.

Revision ID: c4a7e2d19f08
Revises: 8e3c1a9d4b56
Create Date: 2026-11-18 23:30:00
"""

import sqlalchemy as sa
from alembic import op

revision = "c4a7e2d19f08"
down_revision = "8e3c1a9d4b56"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE restaurant SET slug = 'ristorante-' || id WHERE slug IS NULL")
    op.alter_column("restaurant", "slug", existing_type=sa.String(length=40), nullable=False)


def downgrade() -> None:
    op.alter_column("restaurant", "slug", existing_type=sa.String(length=40), nullable=True)
