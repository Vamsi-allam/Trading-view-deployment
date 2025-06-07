from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
from pydantic import BaseModel
from services.discord_service import DiscordService
import logging

# Set up logging
logger = logging.getLogger("discord_routes")
router = APIRouter()

# Model for Discord alert requests
class DiscordAlertRequest(BaseModel):
    alertId: str
    symbol: str
    condition: str
    targetPrice: float
    currentPrice: float
    message: Optional[str] = None

@router.post("/alert", response_model=Dict[str, Any])
async def send_discord_alert(
    alert_data: DiscordAlertRequest,
    discord_service: DiscordService = Depends()
):
    """
    Send an alert notification to Discord
    """
    try:
        logger.info(f"Received Discord alert request: {alert_data}")
        
        # Format the condition for display
        condition_display = {
            "above": "risen above",
            "below": "fallen below",
            "crosses": "crossed"
        }.get(alert_data.condition, alert_data.condition)
        
        # Create a custom message for the alert
        custom_message = alert_data.message or f"Price alert triggered for {alert_data.symbol}!"
        
        # Send the alert to Discord
        result = await discord_service.send_alert(
            symbol=alert_data.symbol,
            alert_type="price",
            condition=condition_display,
            value=str(alert_data.targetPrice),
            current_price=alert_data.currentPrice
        )
        
        logger.info(f"Discord alert sent successfully")
        
        return {
            "success": True,
            "message": "Alert sent to Discord successfully",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error sending Discord alert: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send Discord alert: {str(e)}"
        )

class TestWebhookRequest(BaseModel):
    message: str

@router.post("/test-webhook", response_model=Dict[str, Any])
async def test_discord_webhook(
    request: TestWebhookRequest,
    discord_service: DiscordService = Depends()
):
    """
    Test the Discord webhook by sending a simple message
    """
    try:
        result = await discord_service.send_message(
            content=request.message,
            embeds=[{
                "title": "Webhook Test",
                "description": "This is a test to verify Discord notifications are working",
                "color": 3447003,  # Blue color
                "fields": [
                    {
                        "name": "Status",
                        "value": "✅ Working"
                    }
                ]
            }]
        )
        
        return {
            "success": True,
            "message": "Discord webhook verified successfully",
            "webhook": discord_service.webhook_url[:30] + "..."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Discord webhook test failed: {str(e)}"
        )
