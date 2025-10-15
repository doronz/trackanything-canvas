"""drop_widget_and_dashboard_templates

Revision ID: 5e43514c067d
Revises: 4755251582df
Create Date: 2025-10-07 16:51:55.164509

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e43514c067d'
down_revision: Union[str, None] = '4755251582df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop legacy template tables
    op.drop_table('widget_templates')
    op.drop_table('dashboard_templates')


def downgrade() -> None:
    # Recreate tables if downgrade is needed
    op.create_table(
        'widget_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('widget_type', sa.String(length=100), nullable=False),
        sa.Column('thumbnail', sa.String(length=255), nullable=True),
        sa.Column('template_data', sa.JSON(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_widget_templates_id'), 'widget_templates', ['id'], unique=False)

    op.create_table(
        'dashboard_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('thumbnail', sa.String(length=255), nullable=True),
        sa.Column('template_data', sa.JSON(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dashboard_templates_id'), 'dashboard_templates', ['id'], unique=False)
