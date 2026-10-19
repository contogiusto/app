"""schema iniziale

Revision ID: dd603a361a60
Revises:
Create Date: 2026-10-19 21:55:41.743635
"""

import sqlalchemy as sa
from alembic import op

revision = "dd603a361a60"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "ADMIN",
                "WAITER",
                name="user_role",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_table(
        "restaurant",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "menu_item",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("restaurant_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=60), nullable=False),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("available", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint("price >= 0", name="menu_item_price_non_negative"),
        sa.ForeignKeyConstraint(
            ["restaurant_id"],
            ["restaurant.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_menu_item_restaurant_id"), "menu_item", ["restaurant_id"], unique=False
    )
    op.create_table(
        "restaurant_table",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("restaurant_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("qr_token", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["restaurant_id"],
            ["restaurant.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("qr_token"),
        sa.UniqueConstraint("restaurant_id", "number", name="uq_table_number"),
    )
    op.create_index(
        op.f("ix_restaurant_table_restaurant_id"),
        "restaurant_table",
        ["restaurant_id"],
        unique=False,
    )
    op.create_table(
        "table_session",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "OPEN",
                "CLOSED",
                name="session_status",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("coperti", sa.Integer(), nullable=False),
        sa.Column(
            "payment_mode",
            sa.Enum(
                "ROMANA",
                "OWN",
                name="payment_mode",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column(
            "opened_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint("coperti > 0", name="table_session_coperti_positive"),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["restaurant_table.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_table_session_table_id"), "table_session", ["table_id"], unique=False)
    op.create_table(
        "order_item",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("menu_item_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("added_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("quantity > 0", name="order_item_quantity_positive"),
        sa.ForeignKeyConstraint(
            ["added_by"],
            ["app_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["menu_item_id"],
            ["menu_item.id"],
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["table_session.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_order_item_session_id"), "order_item", ["session_id"], unique=False)
    op.create_table(
        "payment",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "mode",
            sa.Enum(
                "ROMANA",
                "OWN",
                name="payment_mode",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column(
            "method",
            sa.Enum(
                "ONLINE",
                "CASH",
                name="payment_method",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "COMPLETED",
                "CASH",
                name="payment_status",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
        ),
        sa.Column("customer_nickname", sa.String(length=80), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount > 0", name="payment_amount_positive"),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["table_session.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payment_session_id"), "payment", ["session_id"], unique=False)
    op.create_table(
        "payment_item",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payment_id", sa.Integer(), nullable=False),
        sa.Column("order_item_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="payment_item_quantity_positive"),
        sa.ForeignKeyConstraint(
            ["order_item_id"],
            ["order_item.id"],
        ),
        sa.ForeignKeyConstraint(
            ["payment_id"],
            ["payment.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("payment_id", "order_item_id", name="uq_payment_order_item"),
    )
    op.create_index(
        op.f("ix_payment_item_order_item_id"), "payment_item", ["order_item_id"], unique=False
    )
    op.create_index(
        op.f("ix_payment_item_payment_id"), "payment_item", ["payment_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_payment_item_payment_id"), table_name="payment_item")
    op.drop_index(op.f("ix_payment_item_order_item_id"), table_name="payment_item")
    op.drop_table("payment_item")
    op.drop_index(op.f("ix_payment_session_id"), table_name="payment")
    op.drop_table("payment")
    op.drop_index(op.f("ix_order_item_session_id"), table_name="order_item")
    op.drop_table("order_item")
    op.drop_index(op.f("ix_table_session_table_id"), table_name="table_session")
    op.drop_table("table_session")
    op.drop_index(op.f("ix_restaurant_table_restaurant_id"), table_name="restaurant_table")
    op.drop_table("restaurant_table")
    op.drop_index(op.f("ix_menu_item_restaurant_id"), table_name="menu_item")
    op.drop_table("menu_item")
    op.drop_table("restaurant")
    op.drop_table("app_user")
