from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.core.logging import setup_logging
from app.core.exceptions import register_exception_handlers
from app.database import engine, AsyncSessionLocal

# Import routers
from app.routers import auth, medicines, agencies, purchase, inventory, racks, sales, alerts, intelligence

logger = logging.getLogger("app.main")

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
            from app.models.all_models import Role, User
            from app.core.security import hash_password
            from sqlalchemy.future import select
            
            logger.info("Verifying default roles exist...")
            default_roles = ["ADMIN", "MANAGER", "CASHIER", "DOCTOR"]
            for r_name in default_roles:
                query = select(Role).filter(Role.name == r_name)
                res = await db.execute(query)
                role = res.scalars().first()
                if not role:
                    role = Role(name=r_name, description=f"Default system {r_name} role")
                    db.add(role)
            await db.flush()

            # Check if admin user exists
            query_admin = select(User).filter(User.email == "admin@medicalstore.com")
            res_admin = await db.execute(query_admin)
            admin = res_admin.scalars().first()
            if not admin:
                logger.info("Seeding default administrator profile...")
                # Fetch admin role
                query_role = select(Role).filter(Role.name == "ADMIN")
                res_role = await db.execute(query_role)
                admin_role = res_role.scalars().first()
                
                admin_user = User(
                    email="admin@medicalstore.com",
                    password_hash=hash_password("admin123"),
                    full_name="System Administrator",
                    role_id=admin_role.id,
                    is_active=True
                )
                db.add(admin_user)
            
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

@app.get("/health", tags=["Health Checker"])
async def health():
    return {"status": "healthy", "service": "medical-store-backend"}
