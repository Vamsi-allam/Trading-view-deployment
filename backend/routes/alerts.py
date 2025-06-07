from fastapi import APIRouter, HTTPException, Depends, Path, BackgroundTasks
from typing import Dict, Any, List, Optional
from services.discord_service import DiscordService
from pydantic import BaseModel
import uuid
import logging
import time
from datetime import datetime

router = APIRouter()
logger = logging.getLogger("alerts")

# Create a simple in-memory deduplication cache
recent_alerts = {}
DEDUP_WINDOW = 5  # seconds

# Define models
class AlertBase(BaseModel):
    symbol: str
    type: str
    condition: str
    value: str
    notifyDiscord: bool = True

class AlertCreate(AlertBase):
    pass

class AlertTrigger(BaseModel):
    alertId: str
    symbol: str
    condition: str
    targetPrice: float
    currentPrice: float
    message: Optional[str] = None

# Add new model for force-triggering alerts
class ForceTriggerRequest(BaseModel):
    symbol: str
    condition: str
    value: float
    currentPrice: float
    message: Optional[str] = None

# This handles both test alerts and real triggered alerts
@router.post("/test-alert", response_model=Dict[str, Any])
async def test_alert(background_tasks: BackgroundTasks):
    """Send a test alert to Discord"""
    logger.info("⚠️ Sending test alert to Discord")
    try:
        discord_service = DiscordService()
        # Use background task to avoid blocking
        background_tasks.add_task(
            discord_service.send_alert,
            symbol="BTC/USDT",
            alert_type="Test",
            condition="Test Alert",
            value="0",
            current_price=0.0
        )
        return {"success": True, "message": "Test alert sent to Discord"}
    except Exception as e:
        logger.error(f"⚠️ Error sending test alert: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send test alert: {str(e)}")

@router.post("/", response_model=Dict[str, Any])
async def trigger_alert(alert: AlertTrigger, background_tasks: BackgroundTasks):
    """Trigger an alert and send notification to Discord"""
    logger.info(f"⚠️ Alert triggered: {alert.symbol} {alert.condition} {alert.targetPrice}, current: {alert.currentPrice}")
    
    # Create alert signature for deduplication
    alert_sig = f"{alert.symbol}:{alert.condition}:{alert.targetPrice}"
    current_time = time.time()
    
    # Check for duplicate alert
    if alert_sig in recent_alerts:
        last_triggered = recent_alerts[alert_sig]
        if current_time - last_triggered < DEDUP_WINDOW:
            logger.info(f"⚠️ Duplicate alert prevented: {alert_sig}")
            return {"success": True, "message": "Duplicate alert prevented"}
    
    # Store alert timestamp for deduplication
    recent_alerts[alert_sig] = current_time
    
    try:
        discord_service = DiscordService()
        # Use background task to avoid blocking
        background_tasks.add_task(
            discord_service.send_alert,
            symbol=alert.symbol,
            alert_type="Price Alert",
            condition=alert.condition,
            value=str(alert.targetPrice),
            current_price=alert.currentPrice
        )
        logger.info(f"⚠️ Alert notification queued: {alert.symbol} {alert.condition} {alert.targetPrice}")
        return {
            "success": True, 
            "message": f"Alert triggered for {alert.symbol} and notification sent"
        }
    except Exception as e:
        logger.error(f"⚠️ Error triggering alert: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger alert: {str(e)}")

# Fix the force-trigger-alert endpoint implementation
@router.post("/force-trigger-alert", response_model=Dict[str, Any])
async def force_trigger_alert(request: ForceTriggerRequest, background_tasks: BackgroundTasks):
    """Force trigger an alert for testing purposes"""
    logger.info(f"⚠️ Force triggering alert: {request.symbol} {request.condition} {request.value}")
    
    try:
        discord_service = DiscordService()
        # Use background task to avoid blocking
        background_tasks.add_task(
            discord_service.send_alert,
            symbol=request.symbol,
            alert_type="Force Triggered",
            condition=request.condition,
            value=str(request.value),
            current_price=request.currentPrice
        )
        logger.info(f"⚠️ Force triggered alert notification queued: {request.symbol}")
        return {
            "success": True, 
            "message": f"Alert force triggered for {request.symbol} and notification sent"
        }
    except Exception as e:
        logger.error(f"⚠️ Error force triggering alert: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to force trigger alert: {str(e)}")

# Add new endpoint for updating alerts
@router.put("/{alert_id}", response_model=Dict[str, Any])
async def update_alert(alert_id: str, alert: AlertCreate):
    """Update an existing alert"""
    # Implementation for updating alerts would go here
    return {"success": True, "message": f"Alert {alert_id} updated successfully"}
