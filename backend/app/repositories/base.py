from typing import Generic, TypeVar, Type, Any, Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from datetime import datetime
import uuid

from app.database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: uuid.UUID, *, store_id: Optional[uuid.UUID] = None) -> Optional[ModelType]:
        query = select(self.model).filter(self.model.id == id)
        if hasattr(self.model, "deleted_at"):
            query = query.filter(self.model.deleted_at == None)
        if store_id is not None and hasattr(self.model, "store_id"):
            query = query.filter(self.model.store_id == store_id)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100, store_id: Optional[uuid.UUID] = None
    ) -> List[ModelType]:
        query = select(self.model)
        if hasattr(self.model, "deleted_at"):
            query = query.filter(self.model.deleted_at == None)
        if store_id is not None and hasattr(self.model, "store_id"):
            query = query.filter(self.model.store_id == store_id)
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, *, obj_in: Any) -> ModelType:
        db_obj = self.model(**obj_in)
        db.add(db_obj)
        await db.flush()
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: ModelType, obj_in: Dict[str, Any]
    ) -> ModelType:
        for field in obj_in:
            if hasattr(db_obj, field):
                setattr(db_obj, field, obj_in[field])
        db.add(db_obj)
        await db.flush()
        return db_obj

    async def remove(self, db: AsyncSession, *, id: uuid.UUID, store_id: Optional[uuid.UUID] = None) -> Optional[ModelType]:
        db_obj = await self.get(db, id, store_id=store_id)
        if db_obj:
            if hasattr(db_obj, "deleted_at"):
                db_obj.deleted_at = datetime.utcnow()
                db.add(db_obj)
            else:
                await db.delete(db_obj)
            await db.flush()
        return db_obj
