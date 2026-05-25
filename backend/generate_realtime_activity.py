"""
Real-time Activity Simulator for Live Demo
Simulates ongoing parking activity to demonstrate real-time features:
- Random bookings being created
- Spots becoming occupied/available
- Real-time WebSocket updates
Run this during the demo to show live system activity
"""

import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import SessionLocal, User, Vehicle, ParkingSpot, Booking, SpotStatus, BookingStatus
from utils.websocket_manager import manager
import json


class ActivitySimulator:
    def __init__(self, db: Session):
        self.db = db
        self.running = False

    async def simulate_new_booking(self):
        """Simulate a new booking being created"""
        try:
            # Get random user and their vehicle
            users = self.db.query(User).filter(User.is_admin == False).all()
            if not users:
                return

            user = random.choice(users)
            vehicles = self.db.query(Vehicle).filter(Vehicle.user_id == user.id).all()
            if not vehicles:
                return

            vehicle = random.choice(vehicles)

            # Get random available spot
            available_spots = self.db.query(ParkingSpot).filter(
                ParkingSpot.status == SpotStatus.AVAILABLE
            ).all()

            if not available_spots:
                print("⚠️  No available spots for new booking")
                return

            spot = random.choice(available_spots)

            # Create booking for near future
            start_time = datetime.now() + timedelta(minutes=random.randint(5, 30))
            duration = random.randint(1, 4)
            end_time = start_time + timedelta(hours=duration)

            booking = Booking(
                user_id=user.id,
                spot_id=spot.id,
                vehicle_license=vehicle.license_plate,
                status=BookingStatus.CONFIRMED,
                start_time=start_time,
                end_time=end_time,
                price=duration * 5.0
            )

            self.db.add(booking)

            # Reserve the spot if starting soon
            if (start_time - datetime.now()).total_seconds() < 600:  # 10 minutes
                spot.status = SpotStatus.RESERVED

            self.db.commit()
            self.db.refresh(booking)

            print(f"✅ New booking created: {user.username} → Spot {spot.spot_number}")

            # Broadcast update
            await manager.broadcast_booking_update({
                "action": "created",
                "booking": {
                    "id": booking.id,
                    "spot_number": spot.spot_number,
                    "zone": spot.zone,
                    "user": user.username,
                    "start_time": start_time.isoformat(),
                    "duration": duration
                }
            })

        except Exception as e:
            print(f"❌ Error creating booking: {e}")
            self.db.rollback()

    async def simulate_spot_occupied(self):
        """Simulate a reserved spot becoming occupied"""
        try:
            # Find reserved spots with nearby start times
            reserved_spots = self.db.query(ParkingSpot).filter(
                ParkingSpot.status == SpotStatus.RESERVED
            ).all()

            if not reserved_spots:
                # If no reserved spots, pick a random available spot
                available = self.db.query(ParkingSpot).filter(
                    ParkingSpot.status == SpotStatus.AVAILABLE
                ).all()
                if not available:
                    return
                spot = random.choice(available)
            else:
                spot = random.choice(reserved_spots)

            # Update spot status
            spot.status = SpotStatus.OCCUPIED
            spot.last_occupied_at = datetime.now()

            # Update booking if exists
            booking = self.db.query(Booking).filter(
                Booking.spot_id == spot.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
            ).order_by(Booking.start_time).first()

            if booking:
                booking.status = BookingStatus.ACTIVE
                booking.actual_start_time = datetime.now()

            self.db.commit()

            print(f"🚗 Spot occupied: {spot.spot_number} (Zone {spot.zone})")

            # Broadcast update
            await manager.broadcast_parking_update({
                "action": "occupied",
                "spot": {
                    "id": spot.id,
                    "spot_number": spot.spot_number,
                    "zone": spot.zone,
                    "status": "occupied"
                }
            })

        except Exception as e:
            print(f"❌ Error occupying spot: {e}")
            self.db.rollback()

    async def simulate_spot_freed(self):
        """Simulate an occupied spot becoming available"""
        try:
            # Find occupied spots
            occupied_spots = self.db.query(ParkingSpot).filter(
                ParkingSpot.status == SpotStatus.OCCUPIED
            ).all()

            if not occupied_spots:
                print("⚠️  No occupied spots to free")
                return

            spot = random.choice(occupied_spots)

            # Update spot status
            spot.status = SpotStatus.AVAILABLE
            spot.last_freed_at = datetime.now()

            # Complete booking if exists
            booking = self.db.query(Booking).filter(
                Booking.spot_id == spot.id,
                Booking.status == BookingStatus.ACTIVE
            ).order_by(Booking.start_time.desc()).first()

            if booking:
                booking.status = BookingStatus.COMPLETED
                booking.actual_end_time = datetime.now()

            self.db.commit()

            print(f"✅ Spot freed: {spot.spot_number} (Zone {spot.zone})")

            # Broadcast update
            await manager.broadcast_parking_update({
                "action": "freed",
                "spot": {
                    "id": spot.id,
                    "spot_number": spot.spot_number,
                    "zone": spot.zone,
                    "status": "available"
                }
            })

        except Exception as e:
            print(f"❌ Error freeing spot: {e}")
            self.db.rollback()

    async def simulate_booking_cancelled(self):
        """Simulate a booking being cancelled"""
        try:
            # Find pending or confirmed bookings
            cancelable = self.db.query(Booking).filter(
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                Booking.start_time > datetime.now()
            ).all()

            if not cancelable:
                print("⚠️  No bookings to cancel")
                return

            booking = random.choice(cancelable)
            booking.status = BookingStatus.CANCELLED

            # Free up the spot if it was reserved
            spot = self.db.query(ParkingSpot).filter(ParkingSpot.id == booking.spot_id).first()
            if spot and spot.status == SpotStatus.RESERVED:
                spot.status = SpotStatus.AVAILABLE

            self.db.commit()

            print(f"❌ Booking cancelled: Spot {spot.spot_number}")

            # Broadcast update
            await manager.broadcast_booking_update({
                "action": "cancelled",
                "booking": {
                    "id": booking.id,
                    "spot_number": spot.spot_number,
                    "zone": spot.zone
                }
            })

        except Exception as e:
            print(f"❌ Error cancelling booking: {e}")
            self.db.rollback()

    async def run_simulation(self, duration_minutes: int = None):
        """Run the simulation"""
        self.running = True
        start_time = datetime.now()

        print("\n" + "="*60)
        print("REAL-TIME ACTIVITY SIMULATOR")
        print("="*60)
        print("\nSimulating parking lot activity...")
        print("Press Ctrl+C to stop\n")

        if duration_minutes:
            print(f"Running for {duration_minutes} minutes\n")

        iteration = 0

        try:
            while self.running:
                iteration += 1

                # Check if duration limit reached
                if duration_minutes:
                    elapsed = (datetime.now() - start_time).total_seconds() / 60
                    if elapsed >= duration_minutes:
                        print(f"\n✓ Simulation completed ({duration_minutes} minutes)")
                        break

                print(f"\n--- Iteration {iteration} ---")

                # Randomly choose an activity
                activity = random.choices(
                    ['new_booking', 'occupy', 'free', 'cancel', 'nothing'],
                    weights=[30, 25, 25, 10, 10],
                    k=1
                )[0]

                if activity == 'new_booking':
                    await self.simulate_new_booking()
                elif activity == 'occupy':
                    await self.simulate_spot_occupied()
                elif activity == 'free':
                    await self.simulate_spot_freed()
                elif activity == 'cancel':
                    await self.simulate_booking_cancelled()
                else:
                    print("⏸️  Quiet period...")

                # Get current stats
                total_spots = self.db.query(ParkingSpot).count()
                occupied = self.db.query(ParkingSpot).filter(
                    ParkingSpot.status == SpotStatus.OCCUPIED
                ).count()
                reserved = self.db.query(ParkingSpot).filter(
                    ParkingSpot.status == SpotStatus.RESERVED
                ).count()
                available = self.db.query(ParkingSpot).filter(
                    ParkingSpot.status == SpotStatus.AVAILABLE
                ).count()

                occupancy_rate = (occupied / total_spots * 100) if total_spots > 0 else 0

                print(f"📊 Current: {available} available, {occupied} occupied, {reserved} reserved ({occupancy_rate:.1f}% occupancy)")

                # Wait before next action (5-15 seconds)
                wait_time = random.randint(5, 15)
                await asyncio.sleep(wait_time)

        except KeyboardInterrupt:
            print("\n\n⏹️  Simulation stopped by user")
        finally:
            self.running = False


async def main():
    """Main function"""
    import sys

    duration = None
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except ValueError:
            print("Usage: python generate_realtime_activity.py [duration_in_minutes]")
            sys.exit(1)

    db = SessionLocal()

    try:
        # Check if we have data
        user_count = db.query(User).count()
        spot_count = db.query(ParkingSpot).count()

        if user_count == 0 or spot_count == 0:
            print("❌ Error: No test data found!")
            print("Please run 'python generate_test_data.py' first")
            return

        print(f"Found {user_count} users and {spot_count} parking spots")

        simulator = ActivitySimulator(db)
        await simulator.run_simulation(duration)

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
