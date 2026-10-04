from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import JSON, inspect
from app.core.database import Base, engine
from app.api.v1 import auth, orders, planning, loading, delivery, fleet
from app.models import models as app_models

def ensure_order_items_schema():
    Base.metadata.create_all(bind=engine)
    table_name = app_models.Order.__tablename__
    columns = {column["name"] for column in inspect(engine).get_columns(table_name)}
    if "items" not in columns:
        items_type = JSON().compile(dialect=engine.dialect)
        with engine.begin() as connection:
            connection.exec_driver_sql(
                f'ALTER TABLE "{table_name}" ADD COLUMN "items" {items_type}'
            )


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_order_items_schema()
    yield


app = FastAPI(
    title="Nexora Distribution API",
    description="Full-stack logistics management platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins during local dev / hackathon evaluation
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(planning.router, prefix="/api/v1/planning", tags=["Planning"])
app.include_router(loading.router, prefix="/api/v1/loading", tags=["Loading"])
app.include_router(delivery.router, prefix="/api/v1/delivery", tags=["Delivery"])
app.include_router(fleet.router, prefix="/api/v1/fleet", tags=["Fleet"])

@app.get("/")
def read_root():
    return {"message": "Nexora Distribution API is running"}
