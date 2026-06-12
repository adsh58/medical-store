"""initial migration

Revision ID: 1a2b3c4d5e6f
Revises: 
Create Date: 2026-06-12 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Roles
    op.create_table(
        'roles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_roles_deleted_at', 'roles', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 2. Users
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('idx_users_role_id', 'users', ['role_id'], unique=False)
    op.create_index('idx_users_email', 'users', ['email'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('idx_users_deleted_at', 'users', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 3. Medicine Categories
    op.create_table(
        'medicine_categories',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_medicine_categories_deleted_at', 'medicine_categories', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 4. Medicines
    op.create_table(
        'medicines',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('category_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('generic_name', sa.String(length=255), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('pack_size', sa.String(length=100), nullable=False),
        sa.Column('mrp', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('current_purchase_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('doctor_selling_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('customer_selling_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['medicine_categories.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_medicines_category_id', 'medicines', ['category_id'], unique=False)
    op.create_index('idx_medicines_deleted_at', 'medicines', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 5. Racks
    op.create_table(
        'racks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_racks_deleted_at', 'racks', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 6. Shelves
    op.create_table(
        'shelves',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('rack_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['rack_id'], ['racks.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rack_id', 'name', name='uq_rack_shelf')
    )
    op.create_index('idx_shelves_rack_id', 'shelves', ['rack_id'], unique=False)
    op.create_index('idx_shelves_deleted_at', 'shelves', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 7. Agencies
    op.create_table(
        'agencies',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('contact_name', sa.String(length=150), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_agencies_deleted_at', 'agencies', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 8. Purchase Invoices
    op.create_table(
        'purchase_invoices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('agency_id', sa.UUID(), nullable=False),
        sa.Column('invoice_number', sa.String(length=100), nullable=False),
        sa.Column('invoice_date', sa.Date(), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('file_url', sa.String(length=512), nullable=True),
        sa.Column('ai_status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['agency_id'], ['agencies.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agency_id', 'invoice_number', name='uq_agency_invoice')
    )
    op.create_index('idx_purchase_invoices_agency_id', 'purchase_invoices', ['agency_id'], unique=False)
    op.create_index('idx_purchase_invoices_deleted_at', 'purchase_invoices', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 9. Purchase Invoice Items
    op.create_table(
        'purchase_invoice_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=False),
        sa.Column('medicine_id', sa.UUID(), nullable=False),
        sa.Column('batch_number', sa.String(length=100), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('purchase_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('expiry_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['invoice_id'], ['purchase_invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_purchase_invoice_items_invoice_id', 'purchase_invoice_items', ['invoice_id'], unique=False)
    op.create_index('idx_purchase_invoice_items_deleted_at', 'purchase_invoice_items', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 10. Batches
    op.create_table(
        'batches',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('medicine_id', sa.UUID(), nullable=False),
        sa.Column('batch_number', sa.String(length=100), nullable=False),
        sa.Column('expiry_date', sa.Date(), nullable=False),
        sa.Column('mrp', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('purchase_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('medicine_id', 'batch_number', name='uq_medicine_batch')
    )
    op.create_index('idx_batches_medicine_id', 'batches', ['medicine_id'], unique=False)
    op.create_index('idx_batches_deleted_at', 'batches', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 11. Stock
    op.create_table(
        'stock',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=False),
        sa.Column('current_stock', sa.Integer(), nullable=False),
        sa.Column('minimum_stock', sa.Integer(), nullable=False),
        sa.Column('reorder_level', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('batch_id')
    )
    op.create_index('idx_stock_deleted_at', 'stock', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 12. Medicine Location Mappings
    op.create_table(
        'medicine_location_mappings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=False),
        sa.Column('shelf_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shelf_id'], ['shelves.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('batch_id')
    )
    op.create_index('idx_location_mappings_deleted_at', 'medicine_location_mappings', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 13. Sales
    op.create_table(
        'sales',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('cashier_id', sa.UUID(), nullable=False),
        sa.Column('doctor_id', sa.UUID(), nullable=True),
        sa.Column('customer_name', sa.String(length=150), nullable=True),
        sa.Column('customer_phone', sa.String(length=20), nullable=True),
        sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('net_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('payment_mode', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['cashier_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['doctor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sales_deleted_at', 'sales', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 14. Sale Items
    op.create_table(
        'sale_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('sale_id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('net_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sale_items_deleted_at', 'sale_items', ['deleted_at'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))

    # 15. Price History
    op.create_table(
        'price_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('medicine_id', sa.UUID(), nullable=False),
        sa.Column('old_doctor_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('new_doctor_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('old_customer_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('new_customer_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('changed_by', sa.UUID(), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 16. Purchase History
    op.create_table(
        'purchase_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('medicine_id', sa.UUID(), nullable=False),
        sa.Column('agency_id', sa.UUID(), nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=False),
        sa.Column('batch_number', sa.String(length=100), nullable=False),
        sa.Column('old_purchase_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('new_purchase_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('purchased_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['agency_id'], ['agencies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['invoice_id'], ['purchase_invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 17. Inventory Intelligence
    op.create_table(
        'inventory_intelligence',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('medicine_id', sa.UUID(), nullable=False),
        sa.Column('avg_monthly_sales', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('suggested_reorder_qty', sa.Integer(), nullable=False),
        sa.Column('inventory_status', sa.String(length=50), nullable=False),
        sa.Column('last_calculated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('medicine_id')
    )

    # 18. Expiry Tracking
    op.create_table(
        'expiry_tracking',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=False),
        sa.Column('alert_date', sa.Date(), nullable=False),
        sa.Column('alert_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 19. AI Invoice Scan Logs
    op.create_table(
        'ai_invoice_processing_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('token_usage_prompt', sa.Integer(), nullable=False),
        sa.Column('token_usage_completion', sa.Integer(), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['purchase_invoices.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('ai_invoice_processing_logs')
    op.drop_table('expiry_tracking')
    op.drop_table('inventory_intelligence')
    op.drop_table('purchase_history')
    op.drop_table('price_history')
    op.drop_table('sale_items')
    op.drop_table('sales')
    op.drop_table('medicine_location_mappings')
    op.drop_table('stock')
    op.drop_table('batches')
    op.drop_table('purchase_invoice_items')
    op.drop_table('purchase_invoices')
    op.drop_table('agencies')
    op.drop_table('shelves')
    op.drop_table('racks')
    op.drop_table('medicines')
    op.drop_table('medicine_categories')
    op.drop_table('users')
    op.drop_table('roles')
