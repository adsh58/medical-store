"""migrate_to_multitenant

Revision ID: 9c5374b2a854
Revises: b7bf99e91267
Create Date: 2026-06-19 15:48:11.344144

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9c5374b2a854'
down_revision: Union[str, None] = 'b7bf99e91267'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_STORE_ID = 'd80db183-cc46-4cb4-9694-81d3ee507ee6'
SUPER_ADMIN_ROLE_ID = 'e83e9112-9c3f-402a-9ff6-2d1b827e8d01'
SUPER_ADMIN_USER_ID = '11a21e42-7fbb-4b9d-b4b9-29177a6279f0'

def upgrade() -> None:
    # 1. Create stores table
    op.create_table('stores',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Seed default store
    op.execute(f"INSERT INTO stores (id, name, email, phone, address, active) VALUES ('{DEFAULT_STORE_ID}', 'Adarsh Medical', 'vishal58@medical.com', '1234567890', 'Main Road, Adarsh Nagar', true)")

    # 3. Create master_categories
    op.create_table('master_categories',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # 4. Create master_medicines
    op.create_table('master_medicines',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('category_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('generic_name', sa.String(length=255), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('manufacturer', sa.String(length=255), nullable=True),
        sa.Column('pack_size', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['category_id'], ['master_categories.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # 5. Seed SUPER_ADMIN role
    op.execute(f"INSERT INTO roles (id, name, description, created_at, updated_at, is_deleted) VALUES ('{SUPER_ADMIN_ROLE_ID}', 'SUPER_ADMIN', 'System-wide Super Administrator', NOW(), NOW(), false) ON CONFLICT (name) DO NOTHING")

    # 6. Seed SUPER_ADMIN user
    op.execute(f"INSERT INTO users (id, role_id, email, password_hash, full_name, is_active, created_at, updated_at, is_deleted) VALUES ('{SUPER_ADMIN_USER_ID}', '{SUPER_ADMIN_ROLE_ID}', 'superadmin@adarsh.com', '$2b$12$rLk/nllehLWXKxv0gmNWwuuhik5DSHGCiPj8hNIFTT91eHv9t0fAO', 'Super Admin', true, NOW(), NOW(), false)")

    # 7. Create doctors table
    op.create_table('doctors',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('store_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('mobile', sa.String(length=20), nullable=False),
        sa.Column('clinic_name', sa.String(length=255), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by_user_id', sa.UUID(), nullable=True),
        sa.Column('updated_by_user_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # 8. Add nullable store_id and audit columns to business tables
    tables_to_add_store_id = [
        'agencies', 'batches', 'boxes', 'customers', 'medicines',
        'purchase_invoices', 'racks', 'sale_items', 'sales', 'shelves', 'stock',
        'system_settings', 'system_logs', 'users'
    ]

    for table in tables_to_add_store_id:
        op.add_column(table, sa.Column('store_id', sa.UUID(), nullable=True))
        if table != 'users' and table != 'system_logs' and table != 'sale_items' and table != 'system_settings':
            op.add_column(table, sa.Column('created_by_user_id', sa.UUID(), nullable=True))
            op.add_column(table, sa.Column('updated_by_user_id', sa.UUID(), nullable=True))
            op.create_foreign_key(None, table, 'users', ['created_by_user_id'], ['id'], ondelete='SET NULL')
            op.create_foreign_key(None, table, 'users', ['updated_by_user_id'], ['id'], ondelete='SET NULL')
        op.create_foreign_key(None, table, 'stores', ['store_id'], ['id'], ondelete='CASCADE')

    # 9. Set store_id = DEFAULT_STORE_ID for existing data
    for table in tables_to_add_store_id:
        if table == 'users':
            # Seed ADMIN role users to default store, but not SUPER_ADMIN
            op.execute(f"UPDATE users SET store_id = '{DEFAULT_STORE_ID}' WHERE role_id != '{SUPER_ADMIN_ROLE_ID}'")
        elif table == 'system_logs':
            # Keep logs nullable or set to default store
            op.execute(f"UPDATE system_logs SET store_id = '{DEFAULT_STORE_ID}'")
        else:
            op.execute(f"UPDATE {table} SET store_id = '{DEFAULT_STORE_ID}'")

    # 10. Make store_id non-nullable on required tables
    required_store_tables = [
        'agencies', 'batches', 'boxes', 'customers', 'medicines',
        'purchase_invoices', 'racks', 'sale_items', 'sales', 'shelves', 'stock',
        'system_settings'
    ]
    for table in required_store_tables:
        op.alter_column(table, 'store_id', nullable=False)

    # 11. Migrate categories
    op.execute("INSERT INTO master_categories (id, name, description, created_at, updated_at, is_deleted) SELECT id, name, description, created_at, updated_at, is_deleted FROM medicine_categories")

    # 12. Add new columns to medicines table (nullable first)
    op.add_column('medicines', sa.Column('master_medicine_id', sa.UUID(), nullable=True))
    op.add_column('medicines', sa.Column('purchase_rate', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('medicines', sa.Column('doctor_rate', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('medicines', sa.Column('customer_rate', sa.Numeric(precision=10, scale=2), nullable=True))
    op.create_foreign_key(None, 'medicines', 'master_medicines', ['master_medicine_id'], ['id'], ondelete='RESTRICT')

    # 13. Perform detailed data migration for medicines
    connection = op.get_bind()
    results = connection.execute(sa.text(
        "SELECT id, category_id, name, generic_name, company, pack_size, current_purchase_rate, doctor_selling_rate, customer_selling_rate, created_at "
        "FROM medicines"
    )).fetchall()

    for row in results:
        med_id, cat_id, name, gen_name, comp, pack, prate, drate, crate, created = row
        master_med_id = str(uuid.uuid4())
        # Insert into master_medicines
        connection.execute(sa.text(
            "INSERT INTO master_medicines (id, category_id, name, generic_name, company, manufacturer, pack_size, created_at, updated_at, is_deleted) "
            "VALUES (:id, :category_id, :name, :generic_name, :company, :manufacturer, :pack_size, :created_at, NOW(), false)"
        ), {
            "id": master_med_id,
            "category_id": cat_id,
            "name": name,
            "generic_name": gen_name,
            "company": comp,
            "manufacturer": comp,
            "pack_size": pack,
            "created_at": created
        })
        # Update medicines row
        connection.execute(sa.text(
            "UPDATE medicines SET master_medicine_id = :master_med_id, "
            "purchase_rate = :purchase_rate, doctor_rate = :doctor_rate, customer_rate = :customer_rate "
            "WHERE id = :id"
        ), {
            "master_med_id": master_med_id,
            "purchase_rate": prate,
            "doctor_rate": drate,
            "customer_rate": crate,
            "id": med_id
        })

    # 14. Make new columns in medicines table non-nullable
    op.alter_column('medicines', 'master_medicine_id', nullable=False)
    op.alter_column('medicines', 'purchase_rate', nullable=False)
    op.alter_column('medicines', 'doctor_rate', nullable=False)
    op.alter_column('medicines', 'customer_rate', nullable=False)

    # 15. Drop unique constraints and drop old columns from medicines table
    op.drop_constraint('medicines_name_key', 'medicines', type_='unique')
    op.drop_constraint('medicines_category_id_fkey', 'medicines', type_='foreignkey')
    op.drop_column('medicines', 'name')
    op.drop_column('medicines', 'generic_name')
    op.drop_column('medicines', 'company')
    op.drop_column('medicines', 'pack_size')
    op.drop_column('medicines', 'category_id')
    op.drop_column('medicines', 'current_purchase_rate')
    op.drop_column('medicines', 'doctor_selling_rate')
    op.drop_column('medicines', 'customer_selling_rate')

    # 16. Migrate doctor users to doctors table
    doc_role = connection.execute(sa.text("SELECT id FROM roles WHERE name = 'DOCTOR'")).scalar()
    if doc_role:
        doc_users = connection.execute(sa.text("SELECT id, email, full_name, is_active, created_at, updated_at FROM users WHERE role_id = :role_id"), {"role_id": doc_role}).fetchall()
        for du in doc_users:
            du_id, du_email, du_name, du_active, du_created, du_updated = du
            connection.execute(sa.text(
                "INSERT INTO doctors (id, store_id, name, mobile, clinic_name, address, active, created_at, updated_at) "
                "VALUES (:id, :store_id, :name, :mobile, :clinic_name, :address, :active, :created_at, :updated_at)"
            ), {
                "id": du_id,
                "store_id": DEFAULT_STORE_ID,
                "name": du_name,
                "mobile": "0000000000",
                "clinic_name": du_email,
                "address": "Migrated from user accounts",
                "active": du_active,
                "created_at": du_created,
                "updated_at": du_updated
            })
            # Deactivate doctor login
            connection.execute(sa.text("UPDATE users SET is_active = false WHERE id = :id"), {"id": du_id})

    # 17. Update Sales table doctor foreign key reference
    op.drop_constraint('sales_doctor_id_fkey', 'sales', type_='foreignkey')
    op.create_foreign_key(None, 'sales', 'doctors', ['doctor_id'], ['id'], ondelete='SET NULL')

    # 18. Drop unique constraint on customers phone and racks name (since they are now unique per store, not globally)
    op.drop_constraint('customers_phone_key', 'customers', type_='unique')
    op.drop_constraint('racks_name_key', 'racks', type_='unique')
    op.drop_constraint('agencies_name_key', 'agencies', type_='unique')


def downgrade() -> None:
    # Since this is a production schema restructuring, downgrades are not supported due to data division.
    pass
