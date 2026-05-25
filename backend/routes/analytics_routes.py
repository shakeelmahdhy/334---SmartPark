from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from models.database import get_db
from models.user import User
from schemas.analytics import AnalyticsResponse
from controllers.analytics_controller import AnalyticsController
from utils.security import get_current_active_user, get_current_admin_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get analytics data (Admin only)"""
    # Default to last 30 days if not specified
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    return AnalyticsController.generate_analytics(start_date, end_date, db)


@router.post("/generate-daily")
def generate_daily_analytics(
    target_date: date = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Generate daily analytics snapshot (Admin only)"""
    if not target_date:
        target_date = date.today()

    AnalyticsController.save_daily_analytics(target_date, db)
    return {"message": f"Daily analytics generated for {target_date}"}
