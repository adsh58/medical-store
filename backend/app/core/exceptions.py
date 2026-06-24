from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger("app.exceptions")

class AppException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status.HTTP_404_NOT_FOUND)

class BadRequestException(AppException):
    def __init__(self, message: str = "Bad request"):
        super().__init__(message, status.HTTP_400_BAD_REQUEST)

class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED)

class ForbiddenException(AppException):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, status.HTTP_403_FORBIDDEN)

class RateLimitException(AppException):
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, status.HTTP_429_TOO_MANY_REQUESTS)

import traceback
import uuid
from app.database import AsyncSessionLocal
from app.models.all_models import SystemLog
from app.config import settings
from jose import jwt

async def log_to_db(request: Request, log_level: str, message: str, stack_trace: str = None):
    try:
        path = request.url.path
        method = request.method
        
        # Determine module from request path
        module = "general"
        for m in ["auth", "medicines", "agencies", "purchases", "invoices", "inventory", "racks", "sales", "alerts", "intelligence", "customers", "settings"]:
            if f"/{m}" in path:
                module = m
                break
                
        # Parse user if token is present
        user_id = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
                user_id_str = payload.get("sub")
                if user_id_str:
                    user_id = uuid.UUID(user_id_str)
            except Exception:
                pass
                
        # Determine store_id from user if possible
        store_id = None
        async with AsyncSessionLocal() as db:
            if user_id:
                try:
                    from app.models.all_models import User
                    from sqlalchemy import select
                    user_res = await db.execute(select(User.store_id).where(User.id == user_id))
                    store_id = user_res.scalar()
                except Exception as db_err:
                    logger.error(f"Failed to lookup user store_id in log_to_db: {str(db_err)}")

            log_entry = SystemLog(
                store_id=store_id,
                log_level=log_level,
                module=module,
                message=message,
                stack_trace=stack_trace,
                request_path=path,
                request_method=method,
                user_id=user_id
            )
            db.add(log_entry)
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to log system event to database: {str(e)}")

# Global handlers
def register_exception_handlers(app):
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.error(f"AppException raised: {exc.message} on {request.url.path}")
        log_level = "ERROR" if exc.status_code >= 500 else "WARNING"
        await log_to_db(request, log_level, exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "error": exc.message}
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = []
        for error in exc.errors():
            loc = " -> ".join(str(x) for x in error.get("loc", []))
            errors.append(f"{loc}: {error.get('msg')}")
        error_msg = "; ".join(errors)
        logger.error(f"Validation error on {request.url.path}: {error_msg}")
        await log_to_db(request, "WARNING", f"Validation failed: {error_msg}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"success": False, "error": "Validation failed", "details": error_msg}
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        tb = traceback.format_exc()
        logger.exception(f"Unhandled exception on {request.url.path}: {str(exc)}")
        await log_to_db(request, "ERROR", f"Unhandled exception: {str(exc)}", stack_trace=tb)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "error": "An internal server error occurred."}
        )
