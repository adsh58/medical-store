from fastapi import APIRouter, Depends, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.database import get_db
from app.schemas.all_schemas import UserCreate, UserLogin, Token, UserResponse
from app.services.all_services import auth_service
from app.core.dependencies import get_current_user
from app.models.all_models import User, Role

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
async def list_doctors(db: AsyncSession = Depends(get_db)):
    """
    List all active doctors in the store registry.
    """
    from sqlalchemy.future import select
    query = select(User).join(Role).filter(Role.name == "DOCTOR", User.is_active == True)
    res = await db.execute(query)
    return list(res.scalars().all())
