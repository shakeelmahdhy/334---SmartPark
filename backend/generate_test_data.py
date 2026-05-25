"""
Test Data Generator for Smart Parking Management System
Generates realistic test data for live demo:
- 50+ users
- 100 parking spots
- 200+ bookings
- 500+ occupancy logs
- 30+ daily analytics records
"""

import random
import string
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import (
    init_db, SessionLocal, User, Vehicle, ParkingSpot, Booking,
    OccupancyLog, DailyAnalytics, SpotStatus, BookingStatus
)
from utils.security import get_password_hash
from controllers.analytics_controller import AnalyticsController


# Configuration
NUM_USERS = 50
NUM_VEHICLES_PER_USER = 2
NUM_BOOKINGS = 200
NUM_OCCUPANCY_LOGS = 500
DAYS_OF_HISTORY = 30

# Sample data
FIRST_NAMES = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Barbara", "David", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
    "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
    "Edward", "Deborah"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell"
]

CAR_MAKES = ["Toyota", "Honda", "Ford", "Chevrolet", "BMW", "Mercedes", "Audi", "Tesla"]
CAR_MODELS = ["Camry", "Accord", "F-150", "Silverado", "3 Series", "C-Class", "A4", "Model 3"]
CAR_COLORS = ["Black", "White", "Silver", "Blue", "Red", "Gray", "Green"]


def generate_license_plate():
    """Generate a random license plate"""
    letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    numbers = ''.join(random.choices(string.digits, k=4))
    return f"{letters}-{numbers}"


def generate_phone():
    """Generate a random phone number"""
    return f"+1{random.randint(2000000000, 9999999999)}"


def clear_existing_data(db: Session):
    """Clear all existing data from database"""
    print("Clearing existing data...")

    db.query(OccupancyLog).delete()
    db.query(DailyAnalytics).delete()
    db.query(Booking).delete()
    db.query(Vehicle).delete()
    db.query(ParkingSpot).delete()
    db.query(User).delete()

    db.commit()
    print("✓ Existing data cleared")


def create_users(db: Session):
    """Create test users"""
    print(f"\nCreating {NUM_USERS} users...")
    users = []

    # Create admin user
    admin = User(
        email="admin@parking.com",
        username="admin",
        hashed_password=get_password_hash("admin123"),
        full_name="Admin User",
        phone=generate_phone(),
        is_admin=True,
        is_active=True
    )
    db.add(admin)
    users.append(admin)

    # Create regular users
    for i in range(NUM_USERS - 1):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        username = f"{first_name.lower()}.{last_name.lower()}{i}"

        user = User(
            email=f"{username}@example.com",
            username=username,
            hashed_password=get_password_hash("password123"),
            full_name=f"{first_name} {last_name}",
            phone=generate_phone(),
            is_admin=False,
            is_active=True
        )
        db.add(user)
        users.append(user)

    db.commit()
    for user in users:
        db.refresh(user)

    print(f"✓ Created {len(users)} users (1 admin, {len(users)-1} regular)")
    return users


def create_vehicles(db: Session, users: list):
    """Create test vehicles for users"""
    print(f"\nCreating vehicles for users...")
    vehicles = []

    for user in users:
        # Each user gets 1-2 vehicles
        num_vehicles = random.randint(1, NUM_VEHICLES_PER_USER)
        for _ in range(num_vehicles):
            vehicle = Vehicle(
                user_id=user.id,
                license_plate=generate_license_plate(),
                make=random.choice(CAR_MAKES),
                model=random.choice(CAR_MODELS),
                color=random.choice(CAR_COLORS)
            )
            db.add(vehicle)
            vehicles.append(vehicle)

    db.commit()
    print(f"✓ Created {len(vehicles)} vehicles")
    return vehicles


def create_parking_spots(db: Session):
    """Create 100 parking spots across 4 zones"""
    print("\nCreating 100 parking spots...")
    spots = []
    zones = ["A", "B", "C", "D"]
    spots_per_zone = 25

    for zone in zones:
        for i in range(1, spots_per_zone + 1):
            spot = ParkingSpot(
                spot_number=f"{zone}{i:02d}",
                zone=zone,
                floor=1,
                status=SpotStatus.AVAILABLE,
                is_handicap=(i % 10 == 0),  # Every 10th spot
                is_ev_charging=(i % 5 == 0)  # Every 5th spot
            )
            db.add(spot)
            spots.append(spot)

    db.commit()
    for spot in spots:
        db.refresh(spot)

    print(f"✓ Created {len(spots)} parking spots across zones {zones}")
    return spots


def create_bookings(db: Session, users: list, vehicles: list, spots: list):
    """Create test bookings with various statuses and time ranges"""
    print(f"\nCreating {NUM_BOOKINGS} bookings...")
    bookings = []

    base_date = datetime.now()

    # Create bookings with different patterns
    for i in range(NUM_BOOKINGS):
        user = random.choice(users[1:])  # Skip admin
        user_vehicles = [v for v in vehicles if v.user_id == user.id]

        if not user_vehicles:
            continue

        vehicle = random.choice(user_vehicles)
        spot = random.choice(spots)

        # Distribute bookings across time
        if i < NUM_BOOKINGS * 0.3:
            # 30% past bookings (completed)
            days_ago = random.randint(1, DAYS_OF_HISTORY)
            start_time = base_date - timedelta(days=days_ago, hours=random.randint(0, 23))
            duration = random.randint(1, 8)
            status = BookingStatus.COMPLETED
            actual_start = start_time + timedelta(minutes=random.randint(-10, 10))
            actual_end = start_time + timedelta(hours=duration, minutes=random.randint(-15, 15))

        elif i < NUM_BOOKINGS * 0.5:
            # 20% current/active bookings
            start_time = base_date - timedelta(hours=random.randint(0, 4))
            duration = random.randint(2, 6)
            status = BookingStatus.ACTIVE
            actual_start = start_time
            actual_end = None

        elif i < NUM_BOOKINGS * 0.7:
            # 20% upcoming confirmed bookings
            start_time = base_date + timedelta(hours=random.randint(1, 48))
            duration = random.randint(1, 6)
            status = BookingStatus.CONFIRMED
            actual_start = None
            actual_end = None

        elif i < NUM_BOOKINGS * 0.85:
            # 15% future pending bookings
            start_time = base_date + timedelta(days=random.randint(3, 14))
            duration = random.randint(1, 8)
            status = BookingStatus.PENDING
            actual_start = None
            actual_end = None

        else:
            # 15% cancelled bookings
            days_ago = random.randint(1, DAYS_OF_HISTORY)
            start_time = base_date - timedelta(days=days_ago)
            duration = random.randint(1, 6)
            status = BookingStatus.CANCELLED
            actual_start = None
            actual_end = None

        end_time = start_time + timedelta(hours=duration)

        # Calculate price ($5 per hour)
        price = duration * 5.0

        booking = Booking(
            user_id=user.id,
            spot_id=spot.id,
            vehicle_license=vehicle.license_plate,
            status=status,
            start_time=start_time,
            end_time=end_time,
            actual_start_time=actual_start,
            actual_end_time=actual_end,
            price=price,
            created_at=start_time - timedelta(hours=random.randint(1, 24))
        )
        db.add(booking)
        bookings.append(booking)

    db.commit()

    # Update spot statuses based on active bookings
    active_bookings = [b for b in bookings if b.status == BookingStatus.ACTIVE]
    for booking in active_bookings:
        spot = db.query(ParkingSpot).filter(ParkingSpot.id == booking.spot_id).first()
        if spot:
            spot.status = SpotStatus.OCCUPIED
            spot.last_occupied_at = booking.actual_start_time

    # Mark some spots as reserved for upcoming bookings
    confirmed_soon = [b for b in bookings if b.status == BookingStatus.CONFIRMED
                      and (b.start_time - base_date).total_seconds() < 3600]
    for booking in confirmed_soon[:10]:  # Reserve 10 spots
        spot = db.query(ParkingSpot).filter(ParkingSpot.id == booking.spot_id).first()
        if spot and spot.status == SpotStatus.AVAILABLE:
            spot.status = SpotStatus.RESERVED

    db.commit()

    print(f"✓ Created {len(bookings)} bookings")
    print(f"  - Completed: {sum(1 for b in bookings if b.status == BookingStatus.COMPLETED)}")
    print(f"  - Active: {sum(1 for b in bookings if b.status == BookingStatus.ACTIVE)}")
    print(f"  - Confirmed: {sum(1 for b in bookings if b.status == BookingStatus.CONFIRMED)}")
    print(f"  - Pending: {sum(1 for b in bookings if b.status == BookingStatus.PENDING)}")
    print(f"  - Cancelled: {sum(1 for b in bookings if b.status == BookingStatus.CANCELLED)}")

    return bookings


def create_occupancy_logs(db: Session, spots: list, bookings: list):
    """Create historical occupancy logs"""
    print(f"\nCreating occupancy logs...")
    logs = []

    base_date = datetime.now()

    # Create logs from completed bookings
    completed_bookings = [b for b in bookings if b.status == BookingStatus.COMPLETED]

    for booking in completed_bookings:
        # Log when spot became occupied
        occupied_log = OccupancyLog(
            spot_id=booking.spot_id,
            status=SpotStatus.OCCUPIED,
            timestamp=booking.actual_start_time or booking.start_time,
            duration_minutes=int((booking.actual_end_time - booking.actual_start_time).total_seconds() / 60)
                           if booking.actual_end_time and booking.actual_start_time else None
        )
        db.add(occupied_log)
        logs.append(occupied_log)

        # Log when spot became available again
        available_log = OccupancyLog(
            spot_id=booking.spot_id,
            status=SpotStatus.AVAILABLE,
            timestamp=booking.actual_end_time or booking.end_time,
            duration_minutes=None
        )
        db.add(available_log)
        logs.append(available_log)

    # Add some random status changes for maintenance
    for _ in range(20):
        spot = random.choice(spots)
        days_ago = random.randint(1, DAYS_OF_HISTORY)
        timestamp = base_date - timedelta(days=days_ago, hours=random.randint(0, 23))

        # Maintenance start
        maint_start = OccupancyLog(
            spot_id=spot.id,
            status=SpotStatus.MAINTENANCE,
            timestamp=timestamp,
            duration_minutes=None
        )
        db.add(maint_start)
        logs.append(maint_start)

        # Maintenance end
        maint_end = OccupancyLog(
            spot_id=spot.id,
            status=SpotStatus.AVAILABLE,
            timestamp=timestamp + timedelta(hours=random.randint(2, 12)),
            duration_minutes=None
        )
        db.add(maint_end)
        logs.append(maint_end)

    db.commit()
    print(f"✓ Created {len(logs)} occupancy logs")
    return logs


def create_daily_analytics(db: Session):
    """Create daily analytics snapshots"""
    print(f"\nGenerating daily analytics for past {DAYS_OF_HISTORY} days...")

    base_date = datetime.now().date()

    for i in range(DAYS_OF_HISTORY):
        target_date = base_date - timedelta(days=i)
        AnalyticsController.save_daily_analytics(target_date, db)

    analytics_count = db.query(DailyAnalytics).count()
    print(f"✓ Created {analytics_count} daily analytics records")


def generate_statistics(db: Session):
    """Generate and display statistics about the generated data"""
    print("\n" + "="*60)
    print("DATA GENERATION SUMMARY")
    print("="*60)

    # Users
    total_users = db.query(User).count()
    admin_users = db.query(User).filter(User.is_admin == True).count()
    print(f"\n👥 Users: {total_users}")
    print(f"   - Admins: {admin_users}")
    print(f"   - Regular users: {total_users - admin_users}")

    # Vehicles
    total_vehicles = db.query(Vehicle).count()
    print(f"\n🚗 Vehicles: {total_vehicles}")

    # Parking Spots
    total_spots = db.query(ParkingSpot).count()
    available_spots = db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.AVAILABLE).count()
    occupied_spots = db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.OCCUPIED).count()
    reserved_spots = db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.RESERVED).count()
    print(f"\n🅿️  Parking Spots: {total_spots}")
    print(f"   - Available: {available_spots}")
    print(f"   - Occupied: {occupied_spots}")
    print(f"   - Reserved: {reserved_spots}")
    print(f"   - Handicap: {db.query(ParkingSpot).filter(ParkingSpot.is_handicap == True).count()}")
    print(f"   - EV Charging: {db.query(ParkingSpot).filter(ParkingSpot.is_ev_charging == True).count()}")

    # Zone distribution
    print(f"\n   By Zone:")
    for zone in ["A", "B", "C", "D"]:
        zone_count = db.query(ParkingSpot).filter(ParkingSpot.zone == zone).count()
        zone_occupied = db.query(ParkingSpot).filter(
            ParkingSpot.zone == zone,
            ParkingSpot.status == SpotStatus.OCCUPIED
        ).count()
        occupancy_rate = (zone_occupied / zone_count * 100) if zone_count > 0 else 0
        print(f"   - Zone {zone}: {zone_count} spots ({occupancy_rate:.1f}% occupied)")

    # Bookings
    total_bookings = db.query(Booking).count()
    print(f"\n📅 Bookings: {total_bookings}")
    for status in BookingStatus:
        count = db.query(Booking).filter(Booking.status == status).count()
        print(f"   - {status.value.capitalize()}: {count}")

    # Revenue
    total_revenue = db.query(Booking).filter(
        Booking.status != BookingStatus.CANCELLED
    ).with_entities(db.func.sum(Booking.price)).scalar() or 0
    print(f"\n💰 Total Revenue: ${total_revenue:.2f}")

    # Occupancy Logs
    total_logs = db.query(OccupancyLog).count()
    print(f"\n📊 Occupancy Logs: {total_logs}")

    # Analytics
    total_analytics = db.query(DailyAnalytics).count()
    print(f"\n📈 Daily Analytics Records: {total_analytics}")

    # Date range
    earliest_booking = db.query(Booking).order_by(Booking.start_time).first()
    latest_booking = db.query(Booking).order_by(Booking.start_time.desc()).first()
    if earliest_booking and latest_booking:
        print(f"\n📆 Date Range:")
        print(f"   - Earliest booking: {earliest_booking.start_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"   - Latest booking: {latest_booking.start_time.strftime('%Y-%m-%d %H:%M')}")

    print("\n" + "="*60)
    print("✅ TEST DATA GENERATION COMPLETE!")
    print("="*60)


def main():
    """Main function to generate all test data"""
    print("\n" + "="*60)
    print("SMART PARKING SYSTEM - TEST DATA GENERATOR")
    print("="*60)
    print("\nThis script will generate:")
    print(f"  - {NUM_USERS} users (1 admin, {NUM_USERS-1} regular)")
    print(f"  - ~{NUM_USERS * 1.5:.0f} vehicles")
    print(f"  - 100 parking spots")
    print(f"  - {NUM_BOOKINGS} bookings")
    print(f"  - ~{NUM_BOOKINGS * 2} occupancy logs")
    print(f"  - {DAYS_OF_HISTORY} daily analytics records")
    print("\n⚠️  WARNING: This will delete all existing data!")

    response = input("\nDo you want to continue? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("Cancelled.")
        return

    # Initialize database
    print("\nInitializing database...")
    init_db()

    # Create database session
    db = SessionLocal()

    try:
        # Clear existing data
        clear_existing_data(db)

        # Generate test data
        users = create_users(db)
        vehicles = create_vehicles(db, users)
        spots = create_parking_spots(db)
        bookings = create_bookings(db, users, vehicles, spots)
        occupancy_logs = create_occupancy_logs(db, spots, bookings)
        create_daily_analytics(db)

        # Display statistics
        generate_statistics(db)

        # Admin credentials
        print("\n" + "="*60)
        print("TEST ACCOUNTS")
        print("="*60)
        print("\n🔑 Admin Account:")
        print("   Username: admin")
        print("   Password: admin123")
        print("\n🔑 Sample User Accounts:")
        print("   Username: [any username from the list]")
        print("   Password: password123")
        print("\n   Examples:")
        for user in users[1:6]:  # Show first 5 users
            print(f"   - {user.username}")
        print("   - ... and more")

        print("\n" + "="*60)
        print("NEXT STEPS")
        print("="*60)
        print("\n1. Start the backend server:")
        print("   python main.py")
        print("\n2. Start the frontend:")
        print("   cd .. && pnpm dev")
        print("\n3. Login with admin credentials")
        print("\n4. Explore the dashboard, bookings, and analytics!")
        print("\n" + "="*60)

    except Exception as e:
        print(f"\n❌ Error generating test data: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
