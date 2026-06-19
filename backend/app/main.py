from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import uuid

from app.config import settings
from app.core.logging import setup_logging
from app.core.exceptions import register_exception_handlers
from app.database import engine, AsyncSessionLocal

from app.routers import auth, medicines, agencies, purchase, inventory, racks, sales, alerts, intelligence, customers, doctors, stores
from app.routers.settings import router as settings_router

logger = logging.getLogger("app.main")

DEFAULT_STORE_ID = uuid.UUID("d80db183-cc46-4cb4-9694-81d3ee507ee6")

def run_migrations():
    """
    Run Alembic migrations programmatically on application startup.
    This guarantees the target database structure is updated before handling API queries.
    """
    try:
        from alembic.config import Config
        from alembic import command
        
        logger.info("Initializing Alembic programmatic database migration...")
        alembic_cfg = Config("alembic.ini")
        alembic_cfg.set_main_option("sqlalchemy.url", settings.SYNC_DATABASE_URL)
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migration completed successfully.")
    except Exception as e:
        logger.exception(f"Alembic auto-migration failed: {str(e)}")
        raise e

async def seed_data():
    """
    Auto-seed default user roles and an initial administrator account if they are missing.
    """
    async with AsyncSessionLocal() as db:
        try:
            from app.models.all_models import Role, User, Store
            from app.core.security import hash_password
            from sqlalchemy.future import select
            
            # Verify default store exists
            query_store = select(Store).filter(Store.id == DEFAULT_STORE_ID)
            res_store = await db.execute(query_store)
            store = res_store.scalars().first()
            if not store:
                logger.info("Seeding default store Adarsh Medical...")
                store = Store(
                    id=DEFAULT_STORE_ID,
                    name="Adarsh Medical",
                    email="vishal58@medical.com",
                    phone="1234567890",
                    address="Main Road, Adarsh Nagar",
                    active=True
                )
                db.add(store)
                await db.flush()

            logger.info("Verifying default roles exist...")
            default_roles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER", "DOCTOR"]
            for r_name in default_roles:
                query = select(Role).filter(Role.name == r_name)
                res = await db.execute(query)
                role = res.scalars().first()
                if not role:
                    role = Role(name=r_name, description=f"Default system {r_name} role")
                    db.add(role)
            await db.flush()

            # Seed or verify the admin account
            query_admin = select(User).filter(User.email == "vishal58@medical.com")
            res_admin = await db.execute(query_admin)
            admin = res_admin.scalars().first()
            if not admin:
                logger.info("Seeding default administrator profile...")
                # Fetch admin role
                query_role = select(Role).filter(Role.name == "ADMIN")
                res_role = await db.execute(query_role)
                admin_role = res_role.scalars().first()
                
                admin_user = User(
                    email="vishal58@medical.com",
                    password_hash=hash_password("Vishal@5858"),
                    full_name="System Administrator",
                    role_id=admin_role.id,
                    store_id=DEFAULT_STORE_ID,
                    is_active=True
                )
                db.add(admin_user)
            elif admin.store_id is None:
                # Update existing admin to point to default store
                admin.store_id = DEFAULT_STORE_ID
                db.add(admin)
            
            # Seed default system settings for the default store
            from app.models.all_models import SystemSetting
            query_setting = select(SystemSetting).filter(SystemSetting.store_id == DEFAULT_STORE_ID)
            res_setting = await db.execute(query_setting)
            setting = res_setting.scalars().first()
            if not setting:
                logger.info("Seeding default system settings...")
                default_setting = SystemSetting(
                    store_id=DEFAULT_STORE_ID,
                    store_name="Adarsh Medical",
                    currency="₹",
                    customer_margin=30.0,
                    doctor_margin=15.0
                )
                db.add(default_setting)
            
            await db.commit()
            logger.info("Database seeding checked/completed.")
        except Exception as e:
            await db.rollback()
            logger.error(f"Auto-seeding databases failed: {str(e)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup phase
    setup_logging()
    logger.info("Application starting up...")
    
    # Run migrations programmatically
    run_migrations()
    
    # Seed default roles and admin profile
    await seed_data()
    
    yield
    
    # 2. Shutdown phase
    logger.info("Application shutting down...")
    await engine.dispose()

app = FastAPI(
    title="Medical Store Management System API",
    description="Production-grade API endpoints for medicine cataloging, stock control, racks, sales, AI extraction scans, and intelligence alerts.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "https://medical-store-murex.vercel.app",
    "https://medical-store-mskiiy3aw-adarsh-m-projects.vercel.app",
]
if settings.FRONTEND_ORIGIN:
    for origin in settings.FRONTEND_ORIGIN.split(","):
        clean_origin = origin.strip()
        if clean_origin and clean_origin not in origins:
            origins.append(clean_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers mapping
register_exception_handlers(app)

# Register endpoints routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(medicines.router, prefix="/api/v1")
app.include_router(agencies.router, prefix="/api/v1")
app.include_router(purchase.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(racks.router, prefix="/api/v1")
app.include_router(sales.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(customers.router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(doctors.router, prefix="/api/v1")
app.include_router(stores.router, prefix="/api/v1")

@app.get("/health", tags=["Health Checker"])
async def health():
    return {"status": "healthy", "service": "medical-store-backend"}
