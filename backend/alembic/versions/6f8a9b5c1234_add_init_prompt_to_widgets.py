"""add_init_prompt_to_widgets

Revision ID: 6f8a9b5c1234
Revises: 5e43514c067d
Create Date: 2025-10-25 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6f8a9b5c1234"
down_revision: Union[str, None] = "5e43514c067d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add init_prompt column to widgets table
    op.add_column("widgets", sa.Column("init_prompt", sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove init_prompt column from widgets table
    op.drop_column("widgets", "init_prompt")
