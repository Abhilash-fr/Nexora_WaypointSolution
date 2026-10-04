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


@router.post(
    "/receipts",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(RoleEnum.STORE_MANAGER))],
)
def create_receipt(payload: ReceiptCreate, db: Session = Depends(get_db)):
    values = payload.model_dump(exclude={"items"}, by_alias=False)
    receipt = StoreReceiptRecord(
        **values,
        receipt_id=f"RCPT-{uuid4().hex}",
        items=[item.model_dump() for item in payload.items],
    )
    db.add(receipt)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="This delivery reference already exists") from error
    db.refresh(receipt)
    return serialize_receipt(receipt)


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