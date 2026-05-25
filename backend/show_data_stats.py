"""
Display Current Database Statistics
Quick script to view current state of test data
"""

from sqlalchemy import func
from sqlalchemy.orm import Session
from models import SessionLocal, User, Vehicle, ParkingSpot, Booking, OccupancyLog, DailyAnalytics, SpotStatus, BookingStatus
from datetime import datetime


def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)


def show_user_stats(db: Session):
    """Display user statistics"""
    print_section("USER STATISTICS")

    total = db.query(User).count()
    admins = db.query(User).filter(User.is_admin == True).count()
    active = db.query(User).filter(User.is_active == True).count()

    print(f"\n  Total Users: {total}")
    print(f"    ├─ Admins: {admins}")
    print(f"    ├─ Regular Users: {total - admins}")
    print(f"    └─ Active: {active}")

    # Sample users
    print(f"\n  Sample User Accounts:")
    users = db.query(User).filter(User.is_admin == False).limit(10).all()
    for i, user in enumerate(users, 1):
        print(f"    {i:2d}. {user.username:<20} ({user.email})")

    if db.query(User).count() > 10:
        print(f"    ... and {total - 10} more")


def show_vehicle_stats(db: Session):
    """Display vehicle statistics"""
    print_section("VEHICLE STATISTICS")

    total = db.query(Vehicle).count()
    print(f"\n  Total Vehicles: {total}")

    # By make
    makes = db.query(
        Vehicle.make,
        func.count(Vehicle.id).label('count')
    ).group_by(Vehicle.make).all()

    print(f"\n  By Make:")
    for make, count in sorted(makes, key=lambda x: x[1], reverse=True):
        bar = "█" * int(count / 2)
        print(f"    {make:<12} {bar} {count}")


def show_parking_stats(db: Session):
    """Display parking spot statistics"""
    print_section("PARKING SPOT STATISTICS")

    total = db.query(ParkingSpot).count()
    available = db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.AVAILABLE).count()
    occupied = db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.OCCUPIED).count()
    reserved = db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.RESERVED).count()
    maintenance = db.query(ParkingSpot).filter(ParkingSpot.status == SpotStatus.MAINTENANCE).count()

    occupancy_rate = (occupied / total * 100) if total > 0 else 0

    print(f"\n  Total Spots: {total}")
    print(f"    ├─ Available: {available} ({available/total*100:.1f}%)")
    print(f"    ├─ Occupied: {occupied} ({occupied/total*100:.1f}%)")
    print(f"    ├─ Reserved: {reserved} ({reserved/total*100:.1f}%)")
    print(f"    └─ Maintenance: {maintenance}")
    print(f"\n  Overall Occupancy Rate: {occupancy_rate:.1f}%")

    # Special features
    handicap = db.query(ParkingSpot).filter(ParkingSpot.is_handicap == True).count()
    ev = db.query(ParkingSpot).filter(ParkingSpot.is_ev_charging == True).count()
    print(f"\n  Special Features:")
    print(f"    ├─ Handicap Accessible: {handicap}")
    print(f"    └─ EV Charging: {ev}")

    # By zone
    print(f"\n  By Zone:")
    zones = db.query(ParkingSpot.zone).distinct().order_by(ParkingSpot.zone).all()

    for (zone,) in zones:
        zone_total = db.query(ParkingSpot).filter(ParkingSpot.zone == zone).count()
        zone_available = db.query(ParkingSpot).filter(
            ParkingSpot.zone == zone,
            ParkingSpot.status == SpotStatus.AVAILABLE
        ).count()
        zone_occupied = db.query(ParkingSpot).filter(
            ParkingSpot.zone == zone,
            ParkingSpot.status == SpotStatus.OCCUPIED
        ).count()
        zone_reserved = db.query(ParkingSpot).filter(
            ParkingSpot.zone == zone,
            ParkingSpot.status == SpotStatus.RESERVED
        ).count()

        zone_rate = (zone_occupied / zone_total * 100) if zone_total > 0 else 0
        bar = "█" * int(zone_rate / 2)

        print(f"    Zone {zone}: {bar:<50} {zone_rate:5.1f}%")
        print(f"            ({zone_available} avail, {zone_occupied} occup, {zone_reserved} reserv)")


def show_booking_stats(db: Session):
    """Display booking statistics"""
    print_section("BOOKING STATISTICS")

    total = db.query(Booking).count()
    print(f"\n  Total Bookings: {total}")

    # By status
    print(f"\n  By Status:")
    for status in BookingStatus:
        count = db.query(Booking).filter(Booking.status == status).count()
        if count > 0:
            pct = (count / total * 100) if total > 0 else 0
            bar = "█" * int(count / 5)
            print(f"    {status.value.capitalize():<12} {bar:<40} {count:3d} ({pct:5.1f}%)")

    # Revenue
    total_revenue = db.query(func.sum(Booking.price)).filter(
        Booking.status != BookingStatus.CANCELLED
    ).scalar() or 0

    avg_price = db.query(func.avg(Booking.price)).filter(
        Booking.status != BookingStatus.CANCELLED
    ).scalar() or 0

    print(f"\n  Financial:")
    print(f"    ├─ Total Revenue: ${total_revenue:,.2f}")
    print(f"    ├─ Average Booking: ${avg_price:.2f}")
    print(f"    └─ Cancelled Bookings: {db.query(Booking).filter(Booking.status == BookingStatus.CANCELLED).count()}")

    # Date range
    earliest = db.query(Booking).order_by(Booking.start_time).first()
    latest = db.query(Booking).order_by(Booking.start_time.desc()).first()

    if earliest and latest:
        print(f"\n  Date Range:")
        print(f"    ├─ Earliest: {earliest.start_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"    └─ Latest: {latest.start_time.strftime('%Y-%m-%d %H:%M')}")

    # Most active user
    most_active = db.query(
        Booking.user_id,
        func.count(Booking.id).label('count')
    ).group_by(Booking.user_id).order_by(func.count(Booking.id).desc()).first()

    if most_active:
        user = db.query(User).filter(User.id == most_active[0]).first()
        print(f"\n  Most Active User: {user.username} ({most_active[1]} bookings)")


def show_analytics_stats(db: Session):
    """Display analytics statistics"""
    print_section("ANALYTICS STATISTICS")

    occupancy_logs = db.query(OccupancyLog).count()
    daily_analytics = db.query(DailyAnalytics).count()

    print(f"\n  Occupancy Logs: {occupancy_logs}")
    print(f"  Daily Analytics Records: {daily_analytics}")

    if daily_analytics > 0:
        # Average occupancy
        avg_occupancy = db.query(func.avg(DailyAnalytics.avg_occupancy_rate)).scalar()
        avg_revenue = db.query(func.avg(DailyAnalytics.total_revenue)).scalar()
        avg_bookings = db.query(func.avg(DailyAnalytics.total_bookings)).scalar()

        print(f"\n  Daily Averages:")
        print(f"    ├─ Occupancy Rate: {avg_occupancy:.1f}%")
        print(f"    ├─ Revenue: ${avg_revenue:.2f}")
        print(f"    └─ Bookings: {avg_bookings:.1f}")

        # Busiest day
        busiest = db.query(DailyAnalytics).order_by(DailyAnalytics.total_bookings.desc()).first()
        if busiest:
            print(f"\n  Busiest Day: {busiest.date.strftime('%Y-%m-%d')}")
            print(f"    ├─ Bookings: {busiest.total_bookings}")
            print(f"    ├─ Revenue: ${busiest.total_revenue:.2f}")
            print(f"    └─ Occupancy: {busiest.avg_occupancy_rate:.1f}%")


def show_system_health(db: Session):
    """Display system health indicators"""
    print_section("SYSTEM HEALTH CHECK")

    checks = []

    # Check 1: Users exist
    user_count = db.query(User).count()
    checks.append(("Users exist", user_count > 0, f"{user_count} users"))

    # Check 2: Parking spots initialized
    spot_count = db.query(ParkingSpot).count()
    checks.append(("Parking spots initialized", spot_count >= 100, f"{spot_count} spots"))

    # Check 3: Bookings exist
    booking_count = db.query(Booking).count()
    checks.append(("Bookings exist", booking_count > 0, f"{booking_count} bookings"))

    # Check 4: Admin user exists
    admin_exists = db.query(User).filter(User.is_admin == True).count() > 0
    checks.append(("Admin user exists", admin_exists, "Yes" if admin_exists else "No"))

    # Check 5: Active bookings
    active_count = db.query(Booking).filter(Booking.status == BookingStatus.ACTIVE).count()
    checks.append(("Active bookings", active_count > 0, f"{active_count} active"))

    # Check 6: Occupancy logs
    log_count = db.query(OccupancyLog).count()
    checks.append(("Occupancy logs", log_count > 0, f"{log_count} logs"))

    print()
    for check_name, passed, detail in checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name:<30} {detail}")

    all_passed = all(check[1] for check in checks)

    if all_passed:
        print(f"\n  🎉 All checks passed! System is ready for demo.")
    else:
        print(f"\n  ⚠️  Some checks failed. Run 'python generate_test_data.py' to fix.")


def main():
    """Main function"""
    print("\n" + "="*70)
    print("  SMART PARKING SYSTEM - DATABASE STATISTICS")
    print("="*70)
    print(f"  Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    db = SessionLocal()

    try:
        # Check if database has data
        if db.query(User).count() == 0:
            print("\n\n  ❌ No data found in database!")
            print("  Run 'python generate_test_data.py' to generate test data.")
            return

        show_user_stats(db)
        show_vehicle_stats(db)
        show_parking_stats(db)
        show_booking_stats(db)
        show_analytics_stats(db)
        show_system_health(db)

        print("\n" + "="*70)
        print("  END OF REPORT")
        print("="*70 + "\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()
