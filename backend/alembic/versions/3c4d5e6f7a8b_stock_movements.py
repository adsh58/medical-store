"""create stock movements table

Revision ID: 3c4d5e6f7a8b
Revises: 2b3c4d5e6f7a
Create Date: 2026-06-12 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3c4d5e6f7a8b'
down_revision: Union[str, None] = '2b3c4d5e6f7a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create stock_movements table
    op.create_table(
        'stock_movements',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('medicine_id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=False),
        sa.Column('old_quantity', sa.Integer(), nullable=False),
        sa.Column('new_quantity', sa.Integer(), nullable=False),
        sa.Column('difference', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('idx_stock_movements_medicine_id', 'stock_movements', ['medicine_id'], unique=False)
    op.create_index('idx_stock_movements_batch_id', 'stock_movements', ['batch_id'], unique=False)
    op.create_index('idx_stock_movements_created_at', 'stock_movements', ['created_at'], unique=False)
    op.create_index('idx_stock_movements_is_deleted', 'stock_movements', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    # Create soft delete sync trigger
    op.execute("""
        CREATE TRIGGER trigger_sync_is_deleted_stock_movements
        BEFORE INSERT OR UPDATE ON stock_movements
        FOR EACH ROW
        EXECUTE FUNCTION sync_is_deleted_column();
    """)


def downgrade() -> None:
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS trigger_sync_is_deleted_stock_movements ON stock_movements")
    
    # Drop indexes
    op.drop_index('idx_stock_movements_is_deleted', table_name='stock_movements')
    op.drop_index('idx_stock_movements_created_at', table_name='stock_movements')
    op.drop_index('idx_stock_movements_batch_id', table_name='stock_movements')
    op.drop_index('idx_stock_movements_medicine_id', table_name='stock_movements')
    
    # Drop table
    op.drop_table('stock_movements')
