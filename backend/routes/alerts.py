from fastapi import APIRouter, HTTPException, Depends, Path
from typing import Dict, Any, List, Optional
from services.discord_service import DiscordService
from pydantic import BaseModel
import logging
import uuid  # Make sure to import uuid module
import time  # Add this import

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
    condition: Optional[str] = None
    targetPrice: Optional[float] = None
    price: float
    isRealAlert: Optional[bool] = False

# Add new model for force-triggering alerts
class ForceTriggerRequest(BaseModel):
    symbol: str
    condition: str
    value: str
    price: Optional[float] = None

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
        
        # Create an alert signature for deduplication
        alert_sig = f"{symbol}:{alert_data.condition}:{alert_data.targetPrice}:{current_price}"
        current_time = time.time()
        
        # Check for duplicate alerts
        if alert_sig in recent_alerts:
            last_sent = recent_alerts[alert_sig]
            if current_time - last_sent < DEDUP_WINDOW:
                logger.warning(f"Duplicate alert detected and skipped: {alert_sig}")
                return {
                    "success": True,
                    "message": f"Duplicate alert skipped for {symbol}",
                    "data": {"deduplication": True}
                }
        
        # Store this alert in recent alerts cache
        recent_alerts[alert_sig] = current_time
        
        # Clean up old entries from the cache
        recent_alerts_cleaned = {k: v for k, v in recent_alerts.items() 
                               if current_time - v < 30}
        recent_alerts.clear()
        recent_alerts.update(recent_alerts_cleaned)
        
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

@router.post("/", response_model=Dict[str, Any])  # Update to use Dict[str, Any] instead of AlertResponse
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
        
        return {
            "success": True,
            "message": "Alert created successfully",
            "data": {}
        }
    except Exception as e:
        logger.error(f"Error creating alert: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create alert: {str(e)}"
        )

# Fix the force-trigger-alert endpoint implementation
@router.post("/force-trigger-alert", response_model=Dict[str, Any])
async def force_trigger_alert(
    request: ForceTriggerRequest,
    discord_service: DiscordService = Depends()
):
    """
    Force trigger an alert for diagnostic and testing purposes.
    This endpoint simulates the alert triggering process.
    """
    try:
        logger.info(f"Force triggering alert for {request.symbol} {request.condition} {request.value}")
        
        # Format the condition for display
        condition_display = {
            "above": "risen above",
            "below": "fallen below",
            "crosses": "crossed"
        }.get(request.condition, request.condition)
        
        # Ensure price is a valid float
        current_price = 0.0
        if request.price is not None:
            current_price = float(request.price)
        else:
            # If no price provided, use a default value or fetch real price
            current_price = float(request.value) * 1.01 if request.condition == "above" else float(request.value) * 0.99
        
        # Ensure value is properly formatted
        value_str = str(request.value)
        
        # Create a unique ID for this test alert to prevent duplicates
        test_alert_id = f"test_{request.symbol}_{request.condition}_{value_str}_{time.time()}"
        logger.info(f"Generated test alert ID: {test_alert_id}")
        
        try:
            # Send test notification to Discord
            result = await discord_service.send_alert(
                symbol=request.symbol,
                alert_type="test",
                condition=condition_display,
                value=value_str,
                current_price=current_price
            )
            
            return {
                "success": True,
                "message": f"Force triggered alert for {request.symbol}",
                "data": result
            }
        except Exception as discord_error:
            logger.error(f"Discord service error: {str(discord_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Discord notification failed: {str(discord_error)}"
            )
            
    except Exception as e:
        logger.error(f"Error force triggering alert: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to force trigger alert: {str(e)}"
        )

# Add new endpoint for updating alerts
@router.put("/{alert_id}", response_model=Dict[str, Any])
async def update_alert(
    alert_id: str = Path(..., title="The ID of the alert to update"),
    alert_data: AlertCreate = ...,
    discord_service: DiscordService = Depends()
):
    """
    Update an existing alert
    """
    try:
        logger.info(f"Updating alert {alert_id}")
        
        # In a real application, you would look up the alert in a database
        # Here we're just returning a mock successful response
        # For a production app, replace this with actual database update logic
        
        # For now, simulate checking if the alert exists
        # In a real application, you would query your database
        alert_exists = True  # Placeholder for database check
        
        if not alert_exists:
            logger.error(f"Alert {alert_id} not found")
            raise HTTPException(
                status_code=404,
                detail="Alert not found"
            )
        
        # Return a successful response with the updated alert
        return {
            "success": True,
            "message": f"Alert {alert_id} updated successfully",
            "data": {
                "id": alert_id,
                "symbol": alert_data.symbol,
                "type": alert_data.type,
                "condition": alert_data.condition,
                "value": alert_data.value,
                "notifyDiscord": alert_data.notifyDiscord,
                "status": "active",
                "created_at": "2023-01-01T00:00:00Z",  # Placeholder timestamp
                "updated_at": "2023-01-01T00:00:00Z"   # Placeholder timestamp
            }
        }
    except HTTPException:
        # Re-raise HTTP exceptions to preserve status codes
        raise
    except Exception as e:
        logger.error(f"Error updating alert: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update alert: {str(e)}"
        )
