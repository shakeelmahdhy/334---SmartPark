from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from models.database import get_db
from models.user import User, Vehicle
from schemas.user import UserCreate, UserUpdate, AdminUserUpdate, TokenData, VehicleCreate
from config import settings

# ─────────────────────────────────────────────
# JWT TOKEN SETUP
# ─────────────────────────────────────────────
# OAuth2PasswordBearer tells FastAPI where to find the token in requests.
# When a frontend sends a request with "Authorization: Bearer <token>",
# FastAPI extracts that token and passes it to get_current_user().
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ─────────────────────────────────────────────
# HELPER: Hash a plain password
# ─────────────────────────────────────────────
def hash_password(plain_password: str) -> str:
    """Turn 'mypassword123' into '$2b$12$...' (bcrypt hash)."""
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a plain password matches a stored hash. Returns True/False."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


# ─────────────────────────────────────────────
# HELPER: Create a JWT token
# ─────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT token that encodes the user's id/username.
    The token expires after a set time (default: 24 hours from config).
    
    'data' is a dict like {"sub": "username", "user_id": 5}
    The token is a signed string — only our server can decode it.
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire})  # add expiry to the payload
    
    # jwt.encode signs the payload with our SECRET_KEY
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


# ─────────────────────────────────────────────
# DATABASE OPERATIONS: Find users
# ─────────────────────────────────────────────
def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Look up a user row in the DB by email. Returns None if not found."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Look up a user row in the DB by username."""
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Look up a user row in the DB by their numeric id."""
    return db.query(User).filter(User.id == user_id).first()


def get_all_users(db: Session, skip: int = 0, limit: int = 100):
    """Return a paginated list of all users. Used in admin panel."""
    return db.query(User).offset(skip).limit(limit).all()


# ─────────────────────────────────────────────
# CORE AUTH: Register a new user
# ─────────────────────────────────────────────
def create_user(db: Session, user_data: UserCreate) -> User:
    """
    Register a new user:
    1. Check email/username not already taken
    2. Hash password (never store plain text!)
    3. Create User row in DB
    4. Return the User object
    """
    # Step 1: Guard against duplicates
    if get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
    if get_user_by_username(db, user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken"
        )
    
    # Step 2: Hash the password before saving
    hashed_pw = hash_password(user_data.password)
    
    # Step 3: Create the DB object (not saved yet)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_pw,
        full_name=user_data.full_name,
        phone=user_data.phone,
        is_active=True,
        is_admin=False  # new users are always drivers by default
    )
    
    # Step 4: Save to DB
    db.add(new_user)
    db.commit()       # commits the transaction (writes to disk)
    db.refresh(new_user)  # refreshes the object with the DB-assigned id
    return new_user


# ─────────────────────────────────────────────
# CORE AUTH: Authenticate (login) a user
# ─────────────────────────────────────────────
def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """
    Check if a username + password combination is valid.
    Returns the User object if valid, None if not.
    We intentionally do NOT say whether the username or password was wrong —
    that would help attackers know which one to fix.
    """
    user = get_user_by_username(db, username)
    
    if not user:
        return None  # username not found
    
    if not verify_password(password, user.hashed_password):
        return None  # password wrong
    
    if not user.is_active:
        return None  # account deactivated
    
    return user


# ─────────────────────────────────────────────
# DEPENDENCY: Get the currently logged-in user
# ─────────────────────────────────────────────
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    If anything is wrong (expired, invalid, user deleted),
    we raise a 401 Unauthorized error.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the JWT — jose does the signature verification
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if username is None:
            raise credentials_exception
        
        token_data = TokenData(username=username, user_id=user_id)
    
    except JWTError:
        raise credentials_exception  # expired or tampered token
    
    # Look up actual user in DB (token is just a key)
    user = get_user_by_id(db, token_data.user_id)
    
    if user is None:
        raise credentials_exception
    
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Depends on get_current_user, but also checks the account is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Only allows admins. Use this on admin-only endpoints."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ─────────────────────────────────────────────
# USER MANAGEMENT: Update / Delete
# ─────────────────────────────────────────────
def admin_update_user(db: Session, user_id: int, user_data: AdminUserUpdate) -> User:
    """Admin: update another user's profile or active status."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.email is not None:
        user.email = user_data.email
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, user_data: UserUpdate) -> User:
    """Update a user's profile fields. Only changes fields that are provided."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_data.email:
        user.email = user_data.email
    if user_data.full_name:
        user.full_name = user_data.full_name
    if user_data.phone:
        user.phone = user_data.phone
    if user_data.password:
        user.hashed_password = hash_password(user_data.password)
    
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    """Delete a user by id. Returns True if deleted, False if not found."""
    user = get_user_by_id(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


# ─────────────────────────────────────────────
# VEHICLE MANAGEMENT
# ─────────────────────────────────────────────
def add_vehicle(db: Session, user_id: int, vehicle_data: VehicleCreate) -> Vehicle:
    """Register a vehicle to a user's account."""
    new_vehicle = Vehicle(
        user_id=user_id,
        license_plate=vehicle_data.license_plate,
        make=vehicle_data.make,
        model=vehicle_data.model,
        color=vehicle_data.color,
    )
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle


def get_user_vehicles(db: Session, user_id: int):
    """Return all vehicles belonging to a user."""
    return db.query(Vehicle).filter(Vehicle.user_id == user_id).all()