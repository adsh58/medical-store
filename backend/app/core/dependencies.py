from fastapi import Depends, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.config import settings
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.core.security import verify_access_token
from app.models.all_models import User
from app.repositories.all_repos import user_repo

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

async def get_current_user(
    db: AsyncSession = Depends(get_db), 
    token: str = Depends(oauth2_scheme)
) -> User:
    payload = verify_access_token(token)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException("Could not validate credentials")
    
    try:
        import uuid
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException("Invalid token format")

    user = await user_repo.get(db, user_id)
    if not user:
        raise UnauthorizedException("User does not exist")
    if not user.is_active:
        raise UnauthorizedException("Inactive user profile")
        
    return user

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = [r.upper() for r in allowed_roles]

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name.upper() not in self.allowed_roles:
            raise ForbiddenException("You do not have permission to access this resource")
        return current_user
