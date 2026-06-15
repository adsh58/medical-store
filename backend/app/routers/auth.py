from fastapi import APIRouter, Depends, status, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid
from app.database import get_db
from app.schemas.all_schemas import UserCreate, UserLogin, Token, UserResponse, UserUpdate
from app.services.all_services import auth_service
from app.core.dependencies import get_current_user
from app.models.all_models import User, Role
from app.core.cache import query_cache

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user inside the system. Enforces role configuration.
    """
    user = await auth_service.register_user(db, user_in)
    await db.commit()
    return user

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate email credentials and return JWT authorization token pair.
    """
    token = await auth_service.authenticate_user(db, credentials)
    return token

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Retrieve user metadata based on active request JWT claims.
    """
    return current_user

@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token_in: str = Header(..., alias="Authorization"),
    db: AsyncSession = Depends(get_db)
):
    """
    Exchange refresh token for a new set of access/refresh JWT tokens.
    """
    if refresh_token_in.startswith("Bearer "):
        token = refresh_token_in.split(" ")[1]
    else:
        token = refresh_token_in
        
    from app.core.security import verify_refresh_token, create_access_token, create_refresh_token
    from app.repositories.all_repos import user_repo
    from app.core.exceptions import UnauthorizedException
    
    payload = verify_refresh_token(token)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException("Invalid refresh token")
        
    try:
        import uuid
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException("Invalid refresh token format")
        
    user = await user_repo.get(db, user_id)
    if not user or not user.is_active:
        raise UnauthorizedException("User inactive or deleted")
        
    new_access = create_access_token({"sub": str(user.id), "role": user.role.name})
    new_refresh = create_refresh_token({"sub": str(user.id), "role": user.role.name})
    
    return Token(access_token=new_access, refresh_token=new_refresh)

@router.get("/doctors", response_model=List[UserResponse])
async def list_doctors(
    search: Optional[str] = Query(None, description="Search doctors by name or email"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all active doctors in the store registry.
    """
    cache_key = f"doctors:list:{search or 'all'}"
    cached = query_cache.get(cache_key)
    if cached is not None:
        return cached

    from sqlalchemy.future import select
    from sqlalchemy import or_
    from sqlalchemy.orm import selectinload
    query = select(User).join(Role).filter(Role.name == "DOCTOR", User.deleted_at == None)
    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )
    query = query.options(selectinload(User.role))
    res = await db.execute(query)
    docs = list(res.scalars().all())
    
    res_data = [UserResponse.model_validate(d) for d in docs]
    query_cache.set(cache_key, res_data)
    return res_data

@router.post("/doctors", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor(
    doctor_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new doctor.
    """
    doctor_in.role_name = "DOCTOR"
    user = await auth_service.register_user(db, doctor_in)
    await db.commit()
    query_cache.delete("doctors:list")
    return user

@router.put("/doctors/{id}", response_model=UserResponse)
async def update_doctor(
    id: uuid.UUID,
    doctor_in: UserUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update doctor details.
    """
    from app.repositories.all_repos import user_repo
    from app.core.exceptions import NotFoundException
    user = await user_repo.get(db, id)
    if not user:
        raise NotFoundException("Doctor not found")
    
    update_data = {
        "full_name": doctor_in.full_name,
        "email": doctor_in.email,
    }
    if doctor_in.password:
        from app.core.security import hash_password
        update_data["password_hash"] = hash_password(doctor_in.password)
        
    updated_user = await user_repo.update(db, db_obj=user, obj_in=update_data)
    await db.commit()
    query_cache.delete("doctors:list")
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy.future import select
    query = select(User).filter(User.id == updated_user.id).options(selectinload(User.role))
    res = await db.execute(query)
    return res.scalars().first()

@router.delete("/doctors/{id}")
async def delete_doctor(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete doctor record.
    """
    from app.repositories.all_repos import user_repo
    from app.core.exceptions import NotFoundException
    user = await user_repo.get(db, id)
    if not user:
        raise NotFoundException("Doctor not found")
    await user_repo.remove(db, id=id)
    await db.commit()
    query_cache.delete("doctors:list")
    return {"success": True, "message": "Doctor deleted successfully"}

