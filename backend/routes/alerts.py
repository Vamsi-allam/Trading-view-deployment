from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from services.discord_service import DiscordService
from pydantic import BaseModel
import logging

router = APIRouter()
logger = logging.getLogger("alerts")

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
    condition: Optional[str] = None
    targetPrice: Optional[float] = None
    price: float
    isRealAlert: Optional[bool] = False

# This handles both test alerts and real triggered alerts
@router.post("/test-alert", response_model=Dict[str, Any])
async def send_alert_notification(
    alert_data: AlertTrigger,
    discord_service: DiscordService = Depends()
):
    """
    Send an alert notification to Discord.
    Can be used for both test alerts and real triggered alerts.
    """
    try:
        symbol = alert_data.symbol
        current_price = alert_data.price
        
        logger.info(f"Processing {'real' if alert_data.isRealAlert else 'test'} alert for {symbol}")
        
        # Format the condition for display
        condition = "test"
        if alert_data.condition:
            condition = {
                "above": "risen above",
                "below": "fallen below",
                "crosses": "crossed"
            }.get(alert_data.condition, alert_data.condition)
        
        # For real alerts, use targetPrice if available
        target_value = "N/A"
        if alert_data.targetPrice:
            target_value = str(alert_data.targetPrice)
        
        # Send the alert to Discord
        result = await discord_service.send_alert(
            symbol=symbol,
            alert_type="price" if alert_data.isRealAlert else "test",
            condition=condition,
            value=target_value,
            current_price=current_price
        )
        
        return {
            "success": True,
            "message": f"Alert sent to Discord for {symbol}",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error sending alert: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send alert: {str(e)}"
        )

@router.post("/", response_model=AlertResponse)
async def create_alert(
    alert_data: AlertCreate,
    # Don't automatically inject discord_service here
):
    """
    Create a new alert without sending a test notification
    """
    try:
        # Create the alert but don't send a notification
        # Your existing alert creation code...
        
        return created_alert
    except Exception as e:
        logger.error(f"Error creating alert: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create alert: {str(e)}"
        )
