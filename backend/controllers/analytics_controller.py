from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from fastapi import HTTPException
from typing import List, Dict
from datetime import datetime, timedelta, date
from collections import defaultdict
import numpy as np

from models.parking import ParkingSpot, Booking, OccupancyLog, SpotStatus, BookingStatus
from models.analytics import DailyAnalytics
from schemas.analytics import (
    AnalyticsResponse, OccupancyTrend, RevenueTrend,
    PeakHourData, ZonePerformance, PredictionData, AnalyticsDateRange
)


class AnalyticsController:
    @staticmethod
    def generate_analytics(
        start_date: date,
        end_date: date,
        db: Session
    ) -> AnalyticsResponse:
        # Occupancy trends
        occupancy_trends = AnalyticsController._get_occupancy_trends(
            start_date, end_date, db
        )

        # Revenue trends
        revenue_trends = AnalyticsController._get_revenue_trends(
            start_date, end_date, db
        )

        # Peak hours
        peak_hours = AnalyticsController._get_peak_hours(start_date, end_date, db)

        # Zone performance
        zone_performance = AnalyticsController._get_zone_performance(
            start_date, end_date, db
        )

        # Predictions
        predictions = AnalyticsController._generate_predictions(db)

        # Overall stats
        total_revenue = sum(trend.revenue for trend in revenue_trends)
        total_bookings = sum(trend.bookings for trend in revenue_trends)
        avg_occupancy = (
            sum(trend.occupancy_rate for trend in occupancy_trends) / len(occupancy_trends)
            if occupancy_trends else 0
        )

        return AnalyticsResponse(
            occupancy_trends=occupancy_trends,
            revenue_trends=revenue_trends,
            peak_hours=peak_hours,
            zone_performance=zone_performance,
            predictions=predictions,
            total_revenue=round(total_revenue, 2),
            total_bookings=total_bookings,
            avg_occupancy_rate=round(avg_occupancy, 2)
        )

    @staticmethod
    def _get_occupancy_trends(
        start_date: date,
        end_date: date,
        db: Session
    ) -> List[OccupancyTrend]:
        trends = []
        current_date = start_date
        total_spots = db.query(func.count(ParkingSpot.id)).scalar()

        while current_date <= end_date:
            # Get bookings for this day
            day_start = datetime.combine(current_date, datetime.min.time())
            day_end = datetime.combine(current_date, datetime.max.time())

            occupied_count = db.query(func.count(Booking.id)).filter(
                and_(
                    Booking.status.in_([BookingStatus.ACTIVE, BookingStatus.COMPLETED]),
                    Booking.start_time <= day_end,
                    Booking.end_time >= day_start
                )
            ).scalar()

            available = total_spots - occupied_count
            occupancy_rate = (occupied_count / total_spots * 100) if total_spots > 0 else 0

            trends.append(OccupancyTrend(
                date=current_date.strftime("%Y-%m-%d"),
                occupancy_rate=round(occupancy_rate, 2),
                available=max(0, available),
                occupied=occupied_count
            ))

            current_date += timedelta(days=1)

        return trends

    @staticmethod
    def _get_revenue_trends(
        start_date: date,
        end_date: date,
        db: Session
    ) -> List[RevenueTrend]:
        trends = []
        current_date = start_date

        while current_date <= end_date:
            day_start = datetime.combine(current_date, datetime.min.time())
            day_end = datetime.combine(current_date, datetime.max.time())

            # Get bookings for this day
            bookings = db.query(Booking).filter(
                and_(
                    Booking.created_at >= day_start,
                    Booking.created_at <= day_end,
                    Booking.status != BookingStatus.CANCELLED
                )
            ).all()

            revenue = sum(booking.price for booking in bookings)
            booking_count = len(bookings)

            trends.append(RevenueTrend(
                date=current_date.strftime("%Y-%m-%d"),
                revenue=round(revenue, 2),
                bookings=booking_count
            ))

            current_date += timedelta(days=1)

        return trends

    @staticmethod
    def _get_peak_hours(
        start_date: date,
        end_date: date,
        db: Session
    ) -> List[PeakHourData]:
        day_start = datetime.combine(start_date, datetime.min.time())
        day_end = datetime.combine(end_date, datetime.max.time())

        # Get all bookings in the date range
        bookings = db.query(Booking).filter(
            and_(
                Booking.start_time >= day_start,
                Booking.start_time <= day_end,
                Booking.status.in_([BookingStatus.ACTIVE, BookingStatus.COMPLETED])
            )
        ).all()

        # Count bookings by hour
        hour_counts = defaultdict(int)
        for booking in bookings:
            hour = booking.start_time.hour
            hour_counts[hour] += 1

        # Calculate occupancy rate for each hour
        total_spots = db.query(func.count(ParkingSpot.id)).scalar()
        peak_hours = []

        for hour in range(24):
            count = hour_counts.get(hour, 0)
            occupancy_rate = (count / total_spots * 100) if total_spots > 0 else 0

            peak_hours.append(PeakHourData(
                hour=hour,
                occupancy_rate=round(occupancy_rate, 2),
                bookings=count
            ))

        return sorted(peak_hours, key=lambda x: x.occupancy_rate, reverse=True)

    @staticmethod
    def _get_zone_performance(
        start_date: date,
        end_date: date,
        db: Session
    ) -> List[ZonePerformance]:
        day_start = datetime.combine(start_date, datetime.min.time())
        day_end = datetime.combine(end_date, datetime.max.time())

        zones = db.query(ParkingSpot.zone).distinct().all()
        zone_stats = []

        for (zone,) in zones:
            # Get spots in this zone
            zone_spot_ids = [
                spot.id for spot in db.query(ParkingSpot.id).filter(
                    ParkingSpot.zone == zone
                ).all()
            ]

            # Get bookings for this zone
            bookings = db.query(Booking).filter(
                and_(
                    Booking.spot_id.in_(zone_spot_ids),
                    Booking.start_time >= day_start,
                    Booking.start_time <= day_end,
                    Booking.status != BookingStatus.CANCELLED
                )
            ).all()

            total_bookings = len(bookings)
            revenue = sum(booking.price for booking in bookings)

            # Calculate average occupancy rate
            total_zone_spots = len(zone_spot_ids)
            days = (end_date - start_date).days + 1
            avg_occupancy = (total_bookings / (total_zone_spots * days) * 100) if total_zone_spots > 0 else 0

            zone_stats.append(ZonePerformance(
                zone=zone,
                total_bookings=total_bookings,
                avg_occupancy_rate=round(avg_occupancy, 2),
                revenue=round(revenue, 2)
            ))

        return sorted(zone_stats, key=lambda x: x.revenue, reverse=True)

    @staticmethod
    def _generate_predictions(db: Session) -> List[PredictionData]:
        """Generate simple predictions for next 7 days"""
        predictions = []

        # Get historical data for the past 14 days
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=14)

        total_spots = db.query(func.count(ParkingSpot.id)).scalar()

        # Get daily occupancy rates
        daily_rates = []
        for i in range(14):
            day = start_date + timedelta(days=i)
            day_start = datetime.combine(day.date(), datetime.min.time())
            day_end = datetime.combine(day.date(), datetime.max.time())

            occupied = db.query(func.count(Booking.id)).filter(
                and_(
                    Booking.status.in_([BookingStatus.ACTIVE, BookingStatus.COMPLETED]),
                    Booking.start_time <= day_end,
                    Booking.end_time >= day_start
                )
            ).scalar()

            rate = (occupied / total_spots * 100) if total_spots > 0 else 0
            daily_rates.append(rate)

        # Simple moving average prediction
        if daily_rates:
            avg_rate = np.mean(daily_rates)
            std_rate = np.std(daily_rates)

            # Generate predictions for next 7 days
            for i in range(7):
                future_date = end_date + timedelta(days=i)

                # Add some random variation
                variation = np.random.uniform(-std_rate * 0.5, std_rate * 0.5)
                predicted = max(0, min(100, avg_rate + variation))

                predictions.append(PredictionData(
                    timestamp=future_date.strftime("%Y-%m-%d"),
                    predicted_occupancy=round(predicted, 2),
                    confidence=round(max(0.6, 1.0 - (i * 0.05)), 2)
                ))

        return predictions

    @staticmethod
    def save_daily_analytics(date: date, db: Session) -> None:
        """Save daily analytics snapshot"""
        day_start = datetime.combine(date, datetime.min.time())
        day_end = datetime.combine(date, datetime.max.time())

        # Calculate metrics
        total_spots = db.query(func.count(ParkingSpot.id)).scalar()

        bookings = db.query(Booking).filter(
            and_(
                Booking.created_at >= day_start,
                Booking.created_at <= day_end,
                Booking.status != BookingStatus.CANCELLED
            )
        ).all()

        total_bookings = len(bookings)
        total_revenue = sum(booking.price for booking in bookings)

        occupied = db.query(func.count(Booking.id)).filter(
            and_(
                Booking.status.in_([BookingStatus.ACTIVE, BookingStatus.COMPLETED]),
                Booking.start_time <= day_end,
                Booking.end_time >= day_start
            )
        ).scalar()

        avg_occupancy_rate = (occupied / total_spots * 100) if total_spots > 0 else 0

        # Get zone occupancy
        zones = db.query(ParkingSpot.zone).distinct().all()
        zone_occupancy = {}
        for (zone,) in zones:
            zone_spots = [
                spot.id for spot in db.query(ParkingSpot.id).filter(
                    ParkingSpot.zone == zone
                ).all()
            ]
            zone_occupied = db.query(func.count(Booking.id)).filter(
                and_(
                    Booking.spot_id.in_(zone_spots),
                    Booking.status.in_([BookingStatus.ACTIVE, BookingStatus.COMPLETED]),
                    Booking.start_time <= day_end,
                    Booking.end_time >= day_start
                )
            ).scalar()
            zone_occupancy[zone] = round(
                (zone_occupied / len(zone_spots) * 100) if zone_spots else 0, 2
            )

        # Find peak hour
        hour_counts = defaultdict(int)
        for booking in bookings:
            hour_counts[booking.start_time.hour] += 1

        peak_hour = max(hour_counts.items(), key=lambda x: x[1])[0] if hour_counts else None

        # Save or update daily analytics
        analytics = db.query(DailyAnalytics).filter(
            func.date(DailyAnalytics.date) == date
        ).first()

        if analytics:
            analytics.total_bookings = total_bookings
            analytics.total_revenue = total_revenue
            analytics.avg_occupancy_rate = avg_occupancy_rate
            analytics.peak_hour = peak_hour
            analytics.zone_occupancy = zone_occupancy
        else:
            analytics = DailyAnalytics(
                date=datetime.combine(date, datetime.min.time()),
                total_bookings=total_bookings,
                total_revenue=total_revenue,
                avg_occupancy_rate=avg_occupancy_rate,
                peak_hour=peak_hour,
                zone_occupancy=zone_occupancy
            )
            db.add(analytics)

        db.commit()
