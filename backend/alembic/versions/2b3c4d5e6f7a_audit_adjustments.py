"""audit adjustments

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-06-12 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2b3c4d5e6f7a'
down_revision: Union[str, None] = '1a2b3c4d5e6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_deleted column to existing tables
    existing_tables = [
        'roles', 'users', 'medicine_categories', 'medicines', 'racks', 'shelves',
        'agencies', 'purchase_invoices', 'purchase_invoice_items', 'batches',
        'stock', 'medicine_location_mappings', 'sales', 'sale_items'
    ]
    for table in existing_tables:
        op.add_column(table, sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False))

    # 2. Add audit and soft-delete columns to historical/log tables
    op.add_column('price_history', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('price_history', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('price_history', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('price_history', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False))

    op.add_column('purchase_history', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('purchase_history', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('purchase_history', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('purchase_history', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False))

    op.add_column('expiry_tracking', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('expiry_tracking', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('expiry_tracking', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('expiry_tracking', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False))

    op.add_column('inventory_intelligence', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('inventory_intelligence', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('inventory_intelligence', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('inventory_intelligence', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False))

    op.add_column('ai_invoice_processing_logs', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('ai_invoice_processing_logs', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.add_column('ai_invoice_processing_logs', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('ai_invoice_processing_logs', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False))

    # 3. Create boxes table
    op.create_table(
        'boxes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('shelf_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.ForeignKeyConstraint(['shelf_id'], ['shelves.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shelf_id', 'name', name='uq_shelf_box')
    )
    op.create_index('idx_boxes_shelf_id', 'boxes', ['shelf_id'], unique=False)
    op.create_index('idx_boxes_deleted_at', 'boxes', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 4. Refactor medicine_location_mappings to point to boxes instead of shelves
    # Clear any active location mapping records first to prevent foreign key errors
    op.execute("DELETE FROM medicine_location_mappings")
    
    op.drop_constraint('medicine_location_mappings_shelf_id_fkey', 'medicine_location_mappings', type_='foreignkey')
    op.drop_column('medicine_location_mappings', 'shelf_id')
    
    op.add_column('medicine_location_mappings', sa.Column('box_id', sa.UUID(), nullable=False))
    op.create_foreign_key(
        'medicine_location_mappings_box_id_fkey', 
        'medicine_location_mappings', 
        'boxes', 
        ['box_id'], 
        ['id'], 
        ondelete='RESTRICT'
    )
    op.create_index('idx_location_mappings_box_id', 'medicine_location_mappings', ['box_id'], unique=False)

    # 5. Update index triggers and soft delete filters to use is_deleted
    op.drop_index('idx_roles_deleted_at', table_name='roles')
    op.create_index('idx_roles_is_deleted', 'roles', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    op.drop_index('idx_users_email', table_name='users')
    op.create_index('idx_users_email', 'users', ['email'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    op.drop_index('idx_medicine_categories_deleted_at', table_name='medicine_categories')
    op.create_index('idx_medicine_categories_is_deleted', 'medicine_categories', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    op.drop_index('idx_medicines_deleted_at', table_name='medicines')
    op.create_index('idx_medicines_is_deleted', 'medicines', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    op.drop_index('idx_racks_deleted_at', table_name='racks')
    op.create_index('idx_racks_is_deleted', 'racks', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    op.drop_index('idx_shelves_deleted_at', table_name='shelves')
    op.create_index('idx_shelves_is_deleted', 'shelves', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    op.drop_index('idx_agencies_deleted_at', table_name='agencies')
    op.create_index('idx_agencies_is_deleted', 'agencies', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    op.drop_index('idx_purchase_invoices_deleted_at', table_name='purchase_invoices')
    op.create_index('idx_purchase_invoices_is_deleted', 'purchase_invoices', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    op.drop_index('idx_batches_deleted_at', table_name='batches')
    op.create_index('idx_batches_is_deleted', 'batches', ['is_deleted'], unique=False, postgresql_where=sa.text('is_deleted = false'))

    # 6. Database triggers to automatically sync is_deleted flag based on deleted_at setting
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_is_deleted_column()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.deleted_at IS NOT NULL THEN
                NEW.is_deleted = true;
            ELSE
                NEW.is_deleted = false;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Apply trigger function to all tables
    tables_to_trigger = [
        'roles', 'users', 'medicine_categories', 'medicines', 'racks', 'shelves', 'boxes',
        'agencies', 'purchase_invoices', 'purchase_invoice_items', 'batches', 'stock',
        'medicine_location_mappings', 'sales', 'sale_items', 'price_history', 
        'purchase_history', 'expiry_tracking', 'inventory_intelligence', 'ai_invoice_processing_logs'
    ]
    for tbl in tables_to_trigger:
        op.execute(f"""
            CREATE TRIGGER trigger_sync_is_deleted_{tbl}
            BEFORE INSERT OR UPDATE ON {tbl}
            FOR EACH ROW
            EXECUTE FUNCTION sync_is_deleted_column();
        """)


def downgrade() -> None:
    # Drop triggers
    tables_to_trigger = [
        'roles', 'users', 'medicine_categories', 'medicines', 'racks', 'shelves', 'boxes',
        'agencies', 'purchase_invoices', 'purchase_invoice_items', 'batches', 'stock',
        'medicine_location_mappings', 'sales', 'sale_items', 'price_history', 
        'purchase_history', 'expiry_tracking', 'inventory_intelligence', 'ai_invoice_processing_logs'
    ]
    for tbl in tables_to_trigger:
        op.execute(f"DROP TRIGGER IF EXISTS trigger_sync_is_deleted_{tbl} ON {tbl}")
    
    op.execute("DROP FUNCTION IF EXISTS sync_is_deleted_column()")

    # Restore location mappings to shelves
    op.execute("DELETE FROM medicine_location_mappings")
    op.drop_constraint('medicine_location_mappings_box_id_fkey', 'medicine_location_mappings', type_='foreignkey')
    op.drop_column('medicine_location_mappings', 'box_id')
    op.add_column('medicine_location_mappings', sa.Column('shelf_id', sa.UUID(), nullable=False))
    op.create_foreign_key(
        'medicine_location_mappings_shelf_id_fkey',
        'medicine_location_mappings',
        'shelves',
        ['shelf_id'],
        ['id'],
        ondelete='RESTRICT'
    )

    op.drop_table('boxes')

    # Drop is_deleted columns
    for table in tables_to_trigger:
        if table != 'boxes':
            op.drop_column(table, 'is_deleted')

    # Drop audit logs extra columns
    extra_audit_tables = ['price_history', 'purchase_history', 'expiry_tracking', 'inventory_intelligence', 'ai_invoice_processing_logs']
    for tbl in extra_audit_tables:
        op.drop_column(tbl, 'created_at')
        op.drop_column(tbl, 'updated_at')
        op.drop_column(tbl, 'deleted_at')
