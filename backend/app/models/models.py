import enum
from sqlalchemy import Column, String, Integer, Float, Boolean, Date, ForeignKey, JSON
from app.core.database import Base

class RoleEnum(str, enum.Enum):
    DISPATCHER = "dispatcher"
    LOADER = "loader"
    DRIVER = "driver"
    STORE_MANAGER = "store_manager"

# 1. Users Model
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)

# 2. Outlets Model
class Outlet(Base):
    __tablename__ = "outlets"
    outlet_id = Column(String, primary_key=True)
    brand = Column(String, nullable=False)
    district = Column(String, nullable=False)
    depot = Column(String, nullable=False)
    dock_type = Column(String, nullable=False)
    parking_constraint = Column(String, nullable=False)
    window_open_time = Column(String, nullable=False)
    window_close_time = Column(String, nullable=False)
    mall_window = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

# 3. Vehicles Model
class Vehicle(Base):
    __tablename__ = "vehicles"
    vehicle_id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    temp = Column(String, nullable=False)
    weight_cap_kg = Column(Float, nullable=False)
    volume_cap_m3 = Column(Float, nullable=False)
    fuel_type = Column(String, nullable=False)
    km_per_l = Column(Float, nullable=False)
    weekly_fuel_quota_l = Column(Float, nullable=False)
    depot = Column(String, nullable=False)

# 4. Orders Model
class Order(Base):
    __tablename__ = "orders"
    delivery_id = Column(String, primary_key=True)
    order_date = Column(Date, nullable=False)
    dispatch_date = Column(Date, nullable=True)
    dispatch_status = Column(String, default="pending")
    outlet_id = Column(String, ForeignKey("outlets.outlet_id"), nullable=False)
    brand = Column(String, nullable=False)
    district = Column(String, nullable=False)
    depot = Column(String, nullable=False)
    temp_requirement = Column(String, nullable=False)
    order_units = Column(Integer, nullable=False)
    order_weight_kg = Column(Float, nullable=False)
    order_volume_m3 = Column(Float, nullable=False)
    items = Column(JSON, nullable=True)
    vehicle_id = Column(String, ForeignKey("vehicles.vehicle_id"), nullable=True)
    trip_id = Column(Integer, nullable=True)
    seq_in_route = Column(Integer, nullable=True)
    deferred_yesterday = Column(Integer, default=0)
    days_since_last_served = Column(Integer, default=0)

# 5. Trips Model
class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, autoincrement=True)
    trip_id = Column(String, index=True)
    vehicle_id = Column(String, ForeignKey("vehicles.vehicle_id"), nullable=False)
    trip_number = Column(Integer, nullable=False)
    status = Column(String, default="planned")
    shortfall_flag = Column(Boolean, default=False)
    shortfall_notes = Column(String, nullable=True)

# 6. District Travel Model
class DistrictTravel(Base):
    __tablename__ = "district_travel"
    id = Column(Integer, primary_key=True, autoincrement=True)
    origin_district = Column(String, nullable=False)
    destination_district = Column(String, nullable=False)
    travel_time_mins = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=True)
    district = Column(String, nullable=True)
    depot = Column(String, nullable=True)
    road_class = Column(String, nullable=True)
    free_flow_kmh = Column(Float, nullable=True)
    depot_to_district_km = Column(Float, nullable=True)
    depot_to_district_freeflow_min = Column(Float, nullable=True)
    inter_stop_km = Column(Float, nullable=True)
    inter_stop_freeflow_min = Column(Float, nullable=True)

# 7. Calendar Model
class Calendar(Base):
    __tablename__ = "calendar"
    date = Column(Date, primary_key=True)
    day_of_week = Column(String, nullable=False)
    is_working_day = Column(Boolean, default=True)
    notes = Column(String, nullable=True)
    dow = Column(Integer, nullable=True)
    is_weekend = Column(Boolean, nullable=True)
    iso_year = Column(Integer, nullable=True)
    iso_week = Column(Integer, nullable=True)
    is_payday = Column(Boolean, nullable=True)
    festival = Column(String, nullable=True)
    festival_ramp = Column(Float, nullable=True)
    is_holiday = Column(Boolean, nullable=True)
    monsoon = Column(Boolean, nullable=True)
    is_operating = Column(Boolean, nullable=True)

# 8. Service Allowance Model
class ServiceAllowance(Base):
    __tablename__ = "service_allowance"
    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String, nullable=False)
    allowance_type = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    dock_type = Column(String, nullable=True)

class RoadCondition(Base):
    __tablename__ = "road_conditions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    district = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    disruption_index = Column(Float, nullable=False)

class TrafficSpeed(Base):
    __tablename__ = "traffic_speed"
    id = Column(Integer, primary_key=True, autoincrement=True)
    district = Column(String, nullable=False)
    hour = Column(Integer, nullable=False)
    monsoon = Column(Boolean, nullable=False)
    speed_index = Column(Float, nullable=False)
