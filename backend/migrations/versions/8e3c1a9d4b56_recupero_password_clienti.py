"""account cliente: token di recupero password e password_changed_at

Solo tabelle e colonne nuove (nullable): compatibile con la versione di codice precedente
(ADR 0002).

Revision ID: 8e3c1a9d4b56
Revises: 5b1d0f2a7c34
Create Date: 2026-11-18 23:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "8e3c1a9d4b56"
down_revision = "5b1d0f2a7c34"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_table(
        "password_reset_token",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customer.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_password_reset_token_customer_id"),
        "password_reset_token",
        ["customer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_password_reset_token_customer_id"), table_name="password_reset_token")
    op.drop_table("password_reset_token")
    op.drop_column("customer", "password_changed_at")
