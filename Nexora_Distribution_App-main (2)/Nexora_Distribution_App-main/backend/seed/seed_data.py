import csv
import os
from datetime import date

from sqlalchemy import inspect

from app.core.database import Base, SessionLocal, engine
from app.models.models import (
    Calendar,
    DistrictTravel,
    Outlet,
    RoadCondition,
    ServiceAllowance,
    TrafficSpeed,
    User,
    Vehicle,
)

CSV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "CSVs")


def read_csv(filename):
    path = os.path.join(CSV_DIR, filename)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Required seed CSV not found: {path}")
    with open(path, newline="", encoding="utf-8-sig") as csv_file:
        return list(csv.DictReader(csv_file))


def as_bool(value):
    return str(value).strip().lower() in {"1", "true", "yes"}


def ensure_existing_table_columns():
    columns = {
        "orders": {
            "items": "JSON",
        },
        "district_travel": {
            "district": "VARCHAR",
            "depot": "VARCHAR",
            "road_class": "VARCHAR",
            "free_flow_kmh": "FLOAT",
            "depot_to_district_km": "FLOAT",
            "depot_to_district_freeflow_min": "FLOAT",
            "inter_stop_km": "FLOAT",
            "inter_stop_freeflow_min": "FLOAT",
        },
        "calendar": {
            "dow": "INTEGER",
            "is_weekend": "BOOLEAN",
            "iso_year": "INTEGER",
            "iso_week": "INTEGER",
            "is_payday": "BOOLEAN",
            "festival": "VARCHAR",
            "festival_ramp": "FLOAT",
            "is_holiday": "BOOLEAN",
            "monsoon": "BOOLEAN",
            "is_operating": "BOOLEAN",
        },
        "service_allowance": {
            "brand": "VARCHAR",
            "dock_type": "VARCHAR",
        },
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table, table_columns in columns.items():
            existing_columns = {
                column["name"] for column in inspector.get_columns(table)
            }
            for name, sql_type in table_columns.items():
                if name in existing_columns:
                    continue
                connection.exec_driver_sql(
                    f'ALTER TABLE "{table}" ADD COLUMN "{name}" {sql_type}'
                )


def seed_data():
    Base.metadata.create_all(bind=engine)
    ensure_existing_table_columns()
    db = SessionLocal()
    try:
        outlets = [
            Outlet(
                outlet_id=row["outlet_id"],
                brand=row["brand"],
                district=row["district"],
                depot=row["depot"],
                dock_type=row["dock_type"],
                parking_constraint=row["parking_constraint"],
                mall_window=row["mall_window"] or None,
                window_open_time=row["window_open_time"],
                window_close_time=row["window_close_time"],
            )
            for row in read_csv("outlets.csv")
        ]
        vehicles = [
            Vehicle(
                vehicle_id=row["vehicle_id"],
                type=row["type"],
                temp=row["temp"],
                weight_cap_kg=float(row["weight_cap_kg"]),
                volume_cap_m3=float(row["volume_cap_m3"]),
                fuel_type=row["fuel_type"],
                km_per_l=float(row["km_per_l"]),
                weekly_fuel_quota_l=float(row["weekly_fuel_quota_l"]),
                depot=row["depot"],
            )
            for row in read_csv("vehicles.csv")
        ]
        district_travel = [
            DistrictTravel(
                origin_district=row["depot"],
                destination_district=row["district"],
                travel_time_mins=float(row["depot_to_district_freeflow_min"]),
                distance_km=float(row["depot_to_district_km"]),
                district=row["district"],
                depot=row["depot"],
                road_class=row["road_class"],
                free_flow_kmh=float(row["free_flow_kmh"]),
                depot_to_district_km=float(row["depot_to_district_km"]),
                depot_to_district_freeflow_min=float(
                    row["depot_to_district_freeflow_min"]
                ),
                inter_stop_km=float(row["inter_stop_km"]),
                inter_stop_freeflow_min=float(row["inter_stop_freeflow_min"]),
            )
            for row in read_csv("district_travel.csv")
        ]
        calendar = [
            Calendar(
                date=date.fromisoformat(row["date"]),
                day_of_week=row["dow_name"],
                is_working_day=as_bool(row["is_operating"]),
                notes=row["festival"] or None,
                dow=int(row["dow"]),
                is_weekend=as_bool(row["is_weekend"]),
                iso_year=int(row["iso_year"]),
                iso_week=int(row["iso_week"]),
                is_payday=as_bool(row["is_payday"]),
                festival=row["festival"] or None,
                festival_ramp=float(row["festival_ramp"]),
                is_holiday=as_bool(row["is_holiday"]),
                monsoon=as_bool(row["monsoon"]),
                is_operating=as_bool(row["is_operating"]),
            )
            for row in read_csv("calendar.csv")
        ]
        service_allowances = [
            ServiceAllowance(
                category=row["brand"],
                allowance_type="service_time",
                value=float(row["service_allowance_min"]),
                unit="minutes",
                brand=row["brand"],
                dock_type=row["dock_type"],
            )
            for row in read_csv("service_allowance.csv")
        ]
        road_conditions = [
            RoadCondition(
                district=row["district"],
                date=date.fromisoformat(row["date"]),
                disruption_index=float(row["disruption_index"]),
            )
            for row in read_csv("road_conditions.csv")
        ]
        traffic_speeds = [
            TrafficSpeed(
                district=row["district"],
                hour=int(row["hour"]),
                monsoon=as_bool(row["monsoon"]),
                speed_index=float(row["speed_index"]),
            )
            for row in read_csv("traffic_speed.csv")
        ]

        db.query(DistrictTravel).delete(synchronize_session=False)
        db.query(ServiceAllowance).delete(synchronize_session=False)
        db.query(RoadCondition).delete(synchronize_session=False)
        db.query(TrafficSpeed).delete(synchronize_session=False)
        for records in (outlets, vehicles, calendar):
            for record in records:
                db.merge(record)
        db.add_all(
            district_travel
            + service_allowances
            + road_conditions
            + traffic_speeds
        )
        db.commit()

        print(f"Seeded {len(outlets)} outlets and {len(vehicles)} vehicles.")
        print(f"Seeded {len(district_travel)} district-travel rows.")
        print(f"Seeded {len(calendar)} calendar rows.")
        print(f"Seeded {len(service_allowances)} service-allowance rows.")
        print(f"Seeded {len(road_conditions)} road-condition rows.")
        print(f"Seeded {len(traffic_speeds)} traffic-speed rows.")
        print(f"Users table ready ({db.query(User).count()} rows).")
        if not os.path.isfile(os.path.join(CSV_DIR, "orders.csv")):
            print("No orders.csv found; existing orders were left unchanged.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
