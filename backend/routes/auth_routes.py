from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from models.database import get_db
from schemas.user import (
    UserCreate, UserResponse, UserUpdate, AdminUserUpdate,
    Token, VehicleCreate, VehicleResponse
)
from controllers.auth_controller import (
    create_user,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_current_admin_user,
    get_user_by_id,
    get_all_users,
    update_user,
    admin_update_user,
    delete_user,
    add_vehicle,
    get_user_vehicles,
)

# APIRouter groups related endpoints together.
# prefix="/auth" means all routes here start with /auth
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─────────────────────────────────────────────
# POST /auth/register
# ─────────────────────────────────────────────
@router.post("/register", response_model=UserResponse, status_code=201)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user account.
    
    The frontend sends: { email, username, password, full_name, phone }
    We return: the created user (without password!)
    
    response_model=UserResponse ensures password is never included in the response.
    status_code=201 means "Created" (more specific than 200 OK).
    """
    new_user = create_user(db, user_data)
    return new_user


# ─────────────────────────────────────────────
# POST /auth/login
# ─────────────────────────────────────────────
@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Log in with username + password. Returns a JWT token.
    
    OAuth2PasswordRequestForm is a FastAPI built-in that reads
    'username' and 'password' from form data (standard OAuth2 format).
    
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create the JWT token with user info embedded
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


# ─────────────────────────────────────────────
# GET /auth/me
# ─────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
def get_me(current_user=Depends(get_current_active_user)):
    return current_user


# ─────────────────────────────────────────────
# PUT /auth/me — Update own profile
# ─────────────────────────────────────────────
@router.put("/me", response_model=UserResponse)
def update_my_profile(
    user_data: UserUpdate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update the logged-in user's own profile fields."""
    return update_user(db, current_user.id, user_data)


# ─────────────────────────────────────────────
# VEHICLE ENDPOINTS
# ─────────────────────────────────────────────
@router.post("/me/vehicles", response_model=VehicleResponse, status_code=201)
def add_my_vehicle(
    vehicle_data: VehicleCreate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a vehicle to the logged-in user's account."""
    return add_vehicle(db, current_user.id, vehicle_data)


@router.get("/me/vehicles", response_model=list[VehicleResponse])
def get_my_vehicles(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all vehicles belonging to the logged-in user."""
    return get_user_vehicles(db, current_user.id)


# ─────────────────────────────────────────────
# ADMIN ENDPOINTS (require is_admin = True)
# ─────────────────────────────────────────────
@router.get("/users", response_model=list[UserResponse])
def list_all_users(
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_admin_user),  # ← admin only
    db: Session = Depends(get_db)
):
    """Admin: list all registered users. Requires admin role."""
    return get_all_users(db, skip=skip, limit=limit)


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: get a specific user by id."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user_admin(
    user_id: int,
    user_data: AdminUserUpdate,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Admin: update a user's profile or active status."""
    return admin_update_user(db, user_id, user_data)


@router.delete("/users/{user_id}", status_code=204)
def remove_user(
    user_id: int,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Admin: delete a user by id."""
    success = delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")