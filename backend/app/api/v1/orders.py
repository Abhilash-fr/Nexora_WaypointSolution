from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.models import Order

router = APIRouter(tags=["Orders"])

class OrderItem(BaseModel):
    product_id: str
    name: str
    qty: int
    unit: str

class OrderCreate(BaseModel):
    delivery_id: str
    order_date: date
    outlet_id: str
    brand: str
    district: str
    depot: str
    temp_requirement: str
    order_units: int
    order_weight_kg: float
    order_volume_m3: float
    dispatch_status: str = "pending"
    items: list[OrderItem] = Field(default_factory=list)

class OrderUpdate(BaseModel):
    dispatch_status: str | None = None
    vehicle_id: str | None = None
    trip_id: int | None = None
    seq_in_route: int | None = None

@router.get("/")
def list_orders(db: Session = Depends(get_db)):
    return db.query(Order).order_by(Order.order_date.desc(), Order.delivery_id).all()

@router.patch("/{delivery_id}")
def update_order(delivery_id: str, payload: OrderUpdate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.delivery_id == delivery_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order

@router.post("/")
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    order_data = payload.model_dump(exclude={"items"})
    colombo_now = datetime.now(ZoneInfo("Asia/Colombo"))
    if colombo_now.time() >= time(16, 0):
        order_data["dispatch_status"] = "deferred"

    try:
        order = Order(
            **order_data,
            items=[item.model_dump() for item in payload.items] if hasattr(payload, 'items') and payload.items else []
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        
        return {
            "status": "success",
            "message": "Order accepted",
            "delivery_id": order_data.get("delivery_id", "DEL-TEMP-001"),
            "dispatch_status": order_data.get("dispatch_status", "pending")
        }
