import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import Literal
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import update
from app.api.deps import get_db
from app.models.models import EmployeeAccessID, RoleEnum, User
from jose import jwt
from app.core.security import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY

router = APIRouter(tags=["Authentication"])
PASSWORD_HASH_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_HASH_ITERATIONS)
    salt_text = base64.urlsafe_b64encode(salt).decode("ascii")
    digest_text = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt_text}${digest_text}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations_text, salt_text, digest_text = stored_hash.split("$")
        iterations = int(iterations_text)
        if scheme != "pbkdf2_sha256" or iterations != PASSWORD_HASH_ITERATIONS:
            return False
        salt = base64.urlsafe_b64decode(salt_text)
        expected_digest = base64.urlsafe_b64decode(digest_text)
    except (AttributeError, TypeError, ValueError):
        return False

    actual_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual_digest, expected_digest)


class SignupRequest(BaseModel):
    employee_id: str = Field(min_length=1, max_length=64)
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    role: RoleEnum
    brand: Literal["Waypoint-Tech", "Waypoint-Style", "Fresh"] | None = None
    vehicle_type: Literal["Ambient", "Refrigerated", "Van"] | None = None
    location: Literal["Kandy", "Peliyagoda", "Colombo", "Gampaha", "Kalutara", "Galle", "Matale"] | None = None


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: SignupRequest, db: Session = Depends(get_db)):
    employee_id = payload.employee_id.strip().upper()
    username = payload.username.strip()
    if not employee_id:
        raise HTTPException(status_code=422, detail="Employee ID is required")
    if len(username) < 3:
        raise HTTPException(status_code=422, detail="Username must be at least 3 characters")
    if payload.role == RoleEnum.STORE_MANAGER and payload.brand is None:
        raise HTTPException(status_code=422, detail="Choose a brand for the store account")
    if payload.role != RoleEnum.STORE_MANAGER and payload.brand is not None:
        raise HTTPException(status_code=422, detail="Brand can only be set for store manager accounts")
    if payload.role == RoleEnum.STORE_MANAGER and payload.location not in {
        "Colombo", "Gampaha", "Kalutara", "Galle", "Kandy", "Matale",
    }:
        raise HTTPException(status_code=422, detail="Choose a valid store location")
    if payload.role == RoleEnum.DRIVER and payload.vehicle_type is None:
        raise HTTPException(status_code=422, detail="Choose a vehicle type for the driver account")
    if payload.role == RoleEnum.DRIVER and payload.location not in {"Kandy", "Peliyagoda"}:
        raise HTTPException(status_code=422, detail="Choose a valid driver starting location")
    if payload.role not in {RoleEnum.STORE_MANAGER, RoleEnum.DRIVER} and (
        payload.vehicle_type is not None or payload.location is not None
    ):
        raise HTTPException(status_code=422, detail="Vehicle and location details are only allowed for driver and store accounts")
    if payload.role == RoleEnum.STORE_MANAGER and payload.vehicle_type is not None:
        raise HTTPException(status_code=422, detail="Vehicle type can only be set for driver accounts")
    if payload.role == RoleEnum.DRIVER and payload.brand is not None:
        raise HTTPException(status_code=422, detail="Brand can only be set for store manager accounts")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Username is already registered")

    employee = db.query(EmployeeAccessID).filter(
        EmployeeAccessID.employee_id == employee_id,
        EmployeeAccessID.role == payload.role.value,
        EmployeeAccessID.is_active.is_(True),
        EmployeeAccessID.claimed_by_user_id.is_(None),
    ).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee ID is invalid, inactive, already registered, or does not match the selected role",
        )

    user = User(
        username=username,
        hashed_password=hash_password(payload.password),
        role=payload.role.value,
        brand=payload.brand,
        vehicle_type=payload.vehicle_type,
        location=payload.location,
    )
    db.add(user)
    try:
        db.flush()
        claim = db.execute(
            update(EmployeeAccessID)
            .where(
                EmployeeAccessID.employee_id == employee_id,
                EmployeeAccessID.role == payload.role.value,
                EmployeeAccessID.is_active.is_(True),
                EmployeeAccessID.claimed_by_user_id.is_(None),
            )
            .values(claimed_by_user_id=user.id)
        )
        if claim.rowcount != 1:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employee ID is invalid, inactive, already registered, or does not match the selected role",
            )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username is already registered") from error
    return {
        "username": user.username,
        "role": user.role,
        "employee_id": employee_id,
        "brand": user.brand,
        "vehicle_type": user.vehicle_type,
        "location": user.location,
    }


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    token = jwt.encode(
        {"sub": user.username, "role": user.role, "exp": expires_at},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "role": user.role,
        "brand": user.brand,
        "vehicle_type": user.vehicle_type,
        "location": user.location,
    }
