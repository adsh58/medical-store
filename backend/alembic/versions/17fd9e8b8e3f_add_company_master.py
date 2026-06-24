"""add_company_master

Revision ID: 17fd9e8b8e3f
Revises: d392e45ff9cd
Create Date: 2026-06-24 08:56:15.440850

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '17fd9e8b8e3f'
down_revision: Union[str, None] = 'd392e45ff9cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


import uuid

def upgrade() -> None:
    # 1. Create master_companies table
    op.create_table(
        'master_companies',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False, server_default='Standard'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # 2. Add company_id to master_medicines
    op.add_column('master_medicines', sa.Column('company_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_master_medicines_company_id',
        'master_medicines', 'master_companies',
        ['company_id'], ['id'],
        ondelete='RESTRICT'
    )

    # 3. Data migration
    connection = op.get_bind()
    result = connection.execute(sa.text("SELECT DISTINCT company FROM master_medicines WHERE company IS NOT NULL AND company != ''"))
    companies = [row[0] for row in result.fetchall()]
    
    for comp in companies:
        comp_id = str(uuid.uuid4())
        existing = connection.execute(
            sa.text("SELECT id FROM master_companies WHERE name = :name"),
            {"name": comp}
        ).fetchone()
        
        if existing:
            actual_id = existing[0]
        else:
            connection.execute(
                sa.text("INSERT INTO master_companies (id, name, type, is_deleted) VALUES (:id, :name, 'Standard', false)"),
                {"id": comp_id, "name": comp}
            )
            actual_id = comp_id
            
        connection.execute(
            sa.text("UPDATE master_medicines SET company_id = :comp_id WHERE company = :name"),
            {"comp_id": actual_id, "name": comp}
        )

def downgrade() -> None:
    op.drop_constraint('fk_master_medicines_company_id', 'master_medicines', type_='foreignkey')
    op.drop_column('master_medicines', 'company_id')
    op.drop_table('master_companies')
