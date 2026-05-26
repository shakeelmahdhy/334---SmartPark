from fastapi import APIRouter

# Create an empty router for now so main.py can include it without errors.
# Will later add real booking endpoints here.
router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"],
)


@router.get("/ping")
def booking_ping():
    """
    Simple placeholder endpoint to prove the booking router is wired correctly.
    Later will need to replace this with real booking CRUD endpoints.
    """
    return {"message": "booking router is alive"}