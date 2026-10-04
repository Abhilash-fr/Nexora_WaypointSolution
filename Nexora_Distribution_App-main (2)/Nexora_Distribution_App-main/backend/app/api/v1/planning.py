from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models.models import (
    Calendar,
    DistrictTravel,
    Outlet,
    RoadCondition,
    ServiceAllowance,
    TrafficSpeed,
)

router = APIRouter(tags=["Dispatcher & Constraint Data"])


class OutletLocationUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


@router.get("/travel-times")
def get_travel_times(db: Session = Depends(get_db)):
    return db.query(DistrictTravel).all()

@router.get("/calendar")
def get_calendar(db: Session = Depends(get_db)):
    return db.query(Calendar).all()

@router.get("/service-allowances")
def get_service_allowances(db: Session = Depends(get_db)):
    return db.query(ServiceAllowance).all()

@router.get("/road-conditions")
def get_road_conditions(db: Session = Depends(get_db)):
    return db.query(RoadCondition).order_by(RoadCondition.date, RoadCondition.district).all()

@router.get("/traffic-speeds")
def get_traffic_speeds(db: Session = Depends(get_db)):
    return db.query(TrafficSpeed).order_by(TrafficSpeed.district, TrafficSpeed.hour).all()


@router.get("/outlets")
def get_outlets(db: Session = Depends(get_db)):
    return db.query(Outlet).order_by(Outlet.outlet_id).all()


@router.patch("/outlets/{outlet_id}/location")
def update_outlet_location(
    outlet_id: str,
    payload: OutletLocationUpdate,
    db: Session = Depends(get_db),
):
    outlet = db.query(Outlet).filter(Outlet.outlet_id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
    outlet.latitude = payload.latitude
    outlet.longitude = payload.longitude
    db.commit()
    db.refresh(outlet)
    return outlet
