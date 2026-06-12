"""drop_file_url_from_purchase_invoices

Revision ID: 472d459a866c
Revises: 3c4d5e6f7a8b
Create Date: 2026-06-12 21:05:22.059029

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '472d459a866c'
down_revision: Union[str, None] = '3c4d5e6f7a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('purchase_invoices', 'file_url')


def downgrade() -> None:
    op.add_column('purchase_invoices', sa.Column('file_url', sa.String(length=512), nullable=True))
