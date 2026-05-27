"""
Seed a large SmartPark demo dataset.

Creates at least 100 records for each major demo datatype:
- users
- vehicles
- parking spots
- bookings
- occupancy logs
- smart detection events
- daily analytics snapshots

Run from backend:
    python seed_smart_demo_data.py --reset
"""

import argparse
import random
import string
from datetime import datetime, timedelta

from sqlalchemy import func

from config import settings
from controllers.analytics_controller import AnalyticsController
from models.database import SessionLocal
from models import (
    init_db,
    User,
    Vehicle,
    ParkingSpot,
    Booking,
    OccupancyLog,
    DetectionEvent,
    DailyAnalytics,
    SpotStatus,
    BookingStatus,
)
from utils.security import get_password_hash


USER_COUNT = 100
VEHICLE_COUNT = 100
SPOT_COUNT = 100
BOOKING_COUNT = 250
OCCUPANCY_LOG_COUNT = 300
DETECTION_EVENT_COUNT = 100
ANALYTICS_DAYS = 100
HOURLY_RATE = settings.HOURLY_RATE

FIRST_NAMES = [
    "Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery",
    "Jamie", "Quinn", "Drew", "Cameron", "Parker", "Rowan", "Hayden",
]
LAST_NAMES = [
    "Smith", "Nguyen", "Patel", "Garcia", "Brown", "Wilson", "Khan", "Lee",
    "Martin", "Davis", "Chen", "Singh", "Moore", "Taylor", "White",
]
MAKES = ["Toyota", "Honda", "Ford", "Tesla", "Hyundai", "Kia", "Mazda", "BMW"]
MODELS = ["Camry", "Civic", "Focus", "Model 3", "i30", "Sportage", "CX-5", "X3"]
COLORS = ["White", "Black", "Silver", "Blue", "Red", "Gray"]


def random_plate(index: int) -> str:
    letters = "".join(random.choices(string.ascii_uppercase, k=3))
    return f"{letters}-{index:04d}"


def reset_database(db) -> None:
    db.query(DetectionEvent).delete()
    db.query(OccupancyLog).delete()
    db.query(DailyAnalytics).delete()
    db.query(Booking).delete()
    db.query(Vehicle).delete()
    db.query(ParkingSpot).delete()
    db.query(User).delete()
    db.commit()


def create_users(db) -> list[User]:
    users = [
        User(
            username="admin",
            email="admin@smartpark.demo",
            hashed_password=get_password_hash("admin123"),
            full_name="Demo Admin",
            phone="+61000000000",
            is_active=True,
            is_admin=True,
        )
    ]

    for index in range(1, USER_COUNT):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        username = f"user{index:03d}"
        users.append(
            User(
                username=username,
                email=f"{username}@smartpark.demo",
                hashed_password=get_password_hash("password123"),
                full_name=f"{first} {last}",
                phone=f"+61{random.randint(400000000, 499999999)}",
                is_active=True,
                is_admin=False,
            )
        )

    db.add_all(users)
    db.commit()
    for user in users:
        db.refresh(user)
    return users


def create_vehicles(db, users: list[User]) -> list[Vehicle]:
    vehicles = []
    regular_users = [user for user in users if not user.is_admin]
    for index in range(VEHICLE_COUNT):
        owner = regular_users[index % len(regular_users)]
        vehicles.append(
            Vehicle(
                user_id=owner.id,
                license_plate=random_plate(index + 1),
                make=random.choice(MAKES),
                model=random.choice(MODELS),
                color=random.choice(COLORS),
            )
        )

    db.add_all(vehicles)
    db.commit()
    for vehicle in vehicles:
        db.refresh(vehicle)
    return vehicles


def create_spots(db) -> list[ParkingSpot]:
    zones = settings.ZONES or ["A", "B", "C", "D"]
    spots_per_zone = max(1, SPOT_COUNT // len(zones))
    spots = []

    for zone in zones:
        for number in range(1, spots_per_zone + 1):
            spots.append(
                ParkingSpot(
                    spot_number=f"{zone}{number:02d}",
                    zone=zone,
                    floor=1,
                    status=SpotStatus.AVAILABLE,
                    is_handicap=(number % 10 == 0),
                    is_ev_charging=(number % 5 == 0),
                )
            )

    db.add_all(spots[:SPOT_COUNT])
    db.commit()
    for spot in spots[:SPOT_COUNT]:
        db.refresh(spot)
    return spots[:SPOT_COUNT]


def create_bookings(db, users: list[User], vehicles: list[Vehicle], spots: list[ParkingSpot]) -> list[Booking]:
    bookings = []
    regular_users = [user for user in users if not user.is_admin]
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)

    occupied_spots = spots[:20]
    reserved_spots = spots[20:40]

    for index, spot in enumerate(occupied_spots):
        user = regular_users[index % len(regular_users)]
        vehicle = vehicles[index % len(vehicles)]
        start = now - timedelta(minutes=random.randint(10, 90))
        end = start + timedelta(hours=random.randint(1, 4))
        bookings.append(
            Booking(
                user_id=user.id,
                spot_id=spot.id,
                vehicle_license=vehicle.license_plate,
                status=BookingStatus.ACTIVE,
                start_time=start,
                end_time=end,
                actual_start_time=start,
                price=round(((end - start).total_seconds() / 3600) * HOURLY_RATE, 2),
                created_at=start - timedelta(hours=2),
            )
        )
        spot.status = SpotStatus.OCCUPIED
        spot.last_occupied_at = start

    for index, spot in enumerate(reserved_spots):
        user = regular_users[(index + 20) % len(regular_users)]
        vehicle = vehicles[(index + 20) % len(vehicles)]
        start = now + timedelta(minutes=random.randint(15, 240))
        end = start + timedelta(hours=random.randint(1, 4))
        bookings.append(
            Booking(
                user_id=user.id,
                spot_id=spot.id,
                vehicle_license=vehicle.license_plate,
                status=BookingStatus.CONFIRMED,
                start_time=start,
                end_time=end,
                price=round(((end - start).total_seconds() / 3600) * HOURLY_RATE, 2),
                created_at=now - timedelta(hours=random.randint(1, 12)),
            )
        )
        spot.status = SpotStatus.RESERVED

    while len(bookings) < BOOKING_COUNT:
        user = random.choice(regular_users)
        vehicle = random.choice(vehicles)
        spot = random.choice(spots)
        days_ago = random.randint(1, ANALYTICS_DAYS)
        start = now - timedelta(days=days_ago, hours=random.randint(0, 23))
        end = start + timedelta(hours=random.randint(1, 6))
        status = random.choices(
            [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.PENDING],
            weights=[70, 15, 15],
            k=1,
        )[0]
        bookings.append(
            Booking(
                user_id=user.id,
                spot_id=spot.id,
                vehicle_license=vehicle.license_plate,
                status=status,
                start_time=start,
                end_time=end,
                actual_start_time=start if status == BookingStatus.COMPLETED else None,
                actual_end_time=end if status == BookingStatus.COMPLETED else None,
                price=round(((end - start).total_seconds() / 3600) * HOURLY_RATE, 2),
                created_at=start - timedelta(hours=random.randint(1, 24)),
            )
        )

    db.add_all(bookings)
    db.commit()
    return bookings


def create_occupancy_logs(db, spots: list[ParkingSpot]) -> list[OccupancyLog]:
    logs = []
    now = datetime.utcnow()
    statuses = [SpotStatus.AVAILABLE, SpotStatus.OCCUPIED, SpotStatus.RESERVED]

    for index in range(OCCUPANCY_LOG_COUNT):
        spot = spots[index % len(spots)]
        logs.append(
            OccupancyLog(
                spot_id=spot.id,
                status=random.choice(statuses),
                timestamp=now - timedelta(minutes=index * 20),
                duration_minutes=random.randint(15, 240),
            )
        )

    db.add_all(logs)
    db.commit()
    return logs


def create_detection_events(db, spots: list[ParkingSpot]) -> list[DetectionEvent]:
    events = []
    now = datetime.utcnow()
    statuses = [SpotStatus.AVAILABLE, SpotStatus.OCCUPIED, SpotStatus.RESERVED]

    for index in range(DETECTION_EVENT_COUNT):
        spot = spots[index % len(spots)]
        previous = random.choice(statuses)
        detected = random.choice(statuses)
        events.append(
            DetectionEvent(
                spot_id=spot.id,
                sensor_id=f"CAM-{spot.zone}-{(index % 8) + 1:02d}",
                event_type="seeded_simulated_camera",
                previous_status=previous,
                detected_status=detected,
                confidence=round(random.uniform(0.82, 0.99), 2),
                payload={
                    "frame_id": f"seed-frame-{index + 1:04d}",
                    "source": "seed_smart_demo_data.py",
                    "zone": spot.zone,
                },
                processed=True,
                timestamp=now - timedelta(minutes=index * 5),
            )
        )

    db.add_all(events)
    db.commit()
    return events


def create_daily_analytics(db) -> None:
    today = datetime.utcnow().date()
    for offset in range(ANALYTICS_DAYS):
        AnalyticsController.save_daily_analytics(today - timedelta(days=offset), db)


def print_summary(db) -> None:
    print("\nSmartPark demo data ready")
    print(f"Users: {db.query(User).count()}")
    print(f"Vehicles: {db.query(Vehicle).count()}")
    print(f"Parking spots: {db.query(ParkingSpot).count()}")
    print(f"Bookings: {db.query(Booking).count()}")
    print(f"Occupancy logs: {db.query(OccupancyLog).count()}")
    print(f"Detection events: {db.query(DetectionEvent).count()}")
    print(f"Daily analytics: {db.query(DailyAnalytics).count()}")
    print(f"Available spots: {db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.AVAILABLE).count()}")
    print(f"Occupied spots: {db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.OCCUPIED).count()}")
    print(f"Reserved spots: {db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.RESERVED).count()}")
    revenue = db.query(func.sum(Booking.price)).filter(Booking.status != BookingStatus.CANCELLED).scalar() or 0
    print(f"Demo revenue: ${revenue:.2f}")
    print("\nDemo accounts")
    print("Admin: admin / admin123")
    print("User: user001 / password123")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete existing demo data first")
    args = parser.parse_args()

    random.seed(334)
    init_db()
    db = SessionLocal()

    try:
        if args.reset:
            reset_database(db)

        users = create_users(db)
        vehicles = create_vehicles(db, users)
        spots = create_spots(db)
        create_bookings(db, users, vehicles, spots)
        create_occupancy_logs(db, spots)
        create_detection_events(db, spots)
        create_daily_analytics(db)
        print_summary(db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
