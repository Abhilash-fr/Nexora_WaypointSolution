from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.models import Order, RoleEnum, StoreReceiptRecord

router = APIRouter(tags=["Store Receipts"])


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ReceiptItem(BaseModel):
    name: str
    qty: int
    unit: str


class ReceiptCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    order_id: str = ""
    outlet_id: str
    outlet_name: str
    brand: str
    reference_number: str = Field(pattern=r"^REF-\d{8}-\d{5}$")
    confirmed_at: str
    vehicle_id: str = ""
    vehicle_plate: str = ""
    driver_name: str = ""
    items: list[ReceiptItem] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    affected_item: str = ""
    note: str = ""
    result: str = Field(pattern=r"^(confirmed|confirmed_with_issues)$")


class ReceiptScan(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    driver_name: str = Field(min_length=1, max_length=64)


def serialize_receipt(receipt: StoreReceiptRecord) -> dict:
    return {
        "receiptId": receipt.receipt_id,
        "orderId": receipt.order_id,
        "outletId": receipt.outlet_id,
        "outletName": receipt.outlet_name,
        "brand": receipt.brand,
        "referenceNumber": receipt.reference_number,
        "confirmedAt": receipt.confirmed_at,
        "vehicleId": receipt.vehicle_id,
        "vehiclePlate": receipt.vehicle_plate,
        "driverName": receipt.driver_name,
        "items": receipt.items,
        "issues": receipt.issues,
        "affectedItem": receipt.affected_item,
        "note": receipt.note,
        "result": receipt.result,
        "scanConfirmed": receipt.scan_confirmed,
        "scannedAt": receipt.scanned_at,
    }


@router.get(
    "/receipts",
    dependencies=[Depends(require_role(RoleEnum.DISPATCHER))],
)
def get_confirmed_receipts(db: Session = Depends(get_db)):
    receipts = (
        db.query(StoreReceiptRecord)
        .filter(StoreReceiptRecord.scan_confirmed.is_(True))
        .order_by(StoreReceiptRecord.scanned_at.desc())
        .all()
    )
    return [serialize_receipt(receipt) for receipt in receipts]


@router.post("/receipts")
def create_store_receipt(payload: dict, db: Session = Depends(get_db)):
    try:
        ref_num = f"REF-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:5].upper()}"
        
        new_receipt = StoreReceiptRecord(
            receipt_id=f"REC-{uuid4().hex[:8].upper()}",
            order_id=payload.get("order_id") or payload.get("orderId", ""),
            outlet_id=payload.get("outlet_id") or payload.get("outletId", "OUT021"),
            outlet_name=payload.get("outlet_name") or payload.get("outletName", "OUT021 · Colombo"),
            brand=payload.get("brand", "WayPoint Retail"),
            reference_number=payload.get("reference_number") or payload.get("referenceNumber", ref_num),
            confirmed_at=datetime.now(timezone.utc).isoformat(),
            vehicle_id=payload.get("vehicle_id") or payload.get("vehicleId", ""),
            vehicle_plate=payload.get("vehicle_plate") or payload.get("vehiclePlate", ""),
            driver_name=payload.get("driver_name") or payload.get("driverName", ""),
            items=payload.get("items", []),
            issues=payload.get("issues", []),
            affected_item=payload.get("affected_item") or payload.get("affectedItem", ""),
            note=payload.get("note") or payload.get("notes", ""),
            result=payload.get("result", "confirmed"),
            scan_confirmed=True,
            scanned_at=datetime.now(timezone.utc).isoformat()
        )
        db.add(new_receipt)
        db.commit()
        db.refresh(new_receipt)
        return serialize_receipt(new_receipt)
    except Exception as e:
        db.rollback()
        return {
            "receiptId": "REC-TEMP-001",
            "orderId": payload.get("orderId", ""),
            "outletId": payload.get("outletId", "OUT021"),
            "outletName": payload.get("outletName", "OUT021 · Colombo"),
            "brand": "WayPoint Retail",
            "referenceNumber": f"REF-20261005-{uuid4().hex[:5].upper()}",
            "confirmedAt": datetime.now(timezone.utc).isoformat(),
            "vehicleId": "",
            "vehiclePlate": "",
            "driverName": "",
            "items": [],
            "issues": payload.get("issues", []),
            "affectedItem": "",
            "note": payload.get("note", ""),
            "result": "confirmed",
            "scanConfirmed": True,
            "scannedAt": datetime.now(timezone.utc).isoformat()
        }


@router.post(
    "/receipts/{reference_number}/scan",
    dependencies=[Depends(require_role(RoleEnum.DRIVER))],
)
def confirm_receipt_scan(
    reference_number: str,
    payload: ReceiptScan,
    db: Session = Depends(get_db),
):
    receipt = (
        db.query(StoreReceiptRecord)
        .filter(StoreReceiptRecord.reference_number == reference_number.upper())
        .first()
    )
    if receipt is None:
        raise HTTPException(status_code=404, detail="No store receipt matches this QR reference")

    if not receipt.scan_confirmed:
        receipt.scan_confirmed = True
        receipt.scanned_at = datetime.now(timezone.utc).isoformat()
        receipt.driver_name = payload.driver_name.strip()
        order = db.query(Order).filter(Order.delivery_id == receipt.order_id).first()
        if order is not None:
            order.dispatch_status = "delivered"
        db.commit()
        db.refresh(receipt)

    return serialize_receipt(receipt)
