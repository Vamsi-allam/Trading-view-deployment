import os
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv

from services.exchange_service import ExchangeService
from services.discord_service import DiscordService
from routes.prices import router as prices_router

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Trading View Clone API")

# Update CORS middleware for production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://trading-view-deployment.vercel.app",  # Replace with your Vercel domain
        "http://localhost:3000",  # Keep for local development
        "http://localhost:5173",  # Add Vite's default port
        "http://127.0.0.1:5173",  # Also include 127.0.0.1 version
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
exchange_service = ExchangeService()
discord_service = DiscordService()

# In-memory alert storage (replace with database in production)
alerts = []

# Alert model
class AlertBase(BaseModel):
    symbol: str
    type: str  # 'price', 'volume', 'ma_cross'
    condition: str  # 'above', 'below', 'crosses'
    value: str
    notifyDiscord: bool = True

class Alert(AlertBase):
    id: str
    created_at: str
    status: str = "active"

# Background task to check alerts
async def check_alerts(background_tasks: BackgroundTasks):
    # Store last prices to detect crosses
    last_prices = {}
    
    while True:
        for alert in alerts:
            if alert["status"] != "active":
                continue
                
            try:
                symbol = alert["symbol"]
                current_price = await exchange_service.get_current_price(symbol)
                alert_value = float(alert["value"])
                last_price = last_prices.get(f"{symbol}_{alert['id']}", current_price)
                
                print(f"CROSS DEBUG: Checking alert: {alert['id']}, {symbol}, {alert['condition']} {alert_value}, current={current_price}, last={last_price}")
                
                is_triggered = False
                
                # Handle different conditions
                if alert["condition"] == "above" and current_price > alert_value:
                    print(f"CROSS DEBUG: Above condition met")
                    is_triggered = True
                elif alert["condition"] == "below" and current_price < alert_value:
                    print(f"CROSS DEBUG: Below condition met")
                    is_triggered = True
                elif alert["condition"] == "crosses":
                    # Check if price crossed the threshold
                    crossed_up = last_price < alert_value and current_price >= alert_value
                    crossed_down = last_price > alert_value and current_price <= alert_value
                    
                    if crossed_up or crossed_down:
                        print(f"CROSS DEBUG: Crosses condition met - price crossed from {last_price} to {current_price}, threshold={alert_value}")
                        is_triggered = True
                    else:
                        # Also check if price is very close to the threshold
                        diff = abs(current_price - alert_value)
                        threshold = max(0.001 * alert_value, 0.5)  # 0.1% or 0.5 units
                        
                        if diff < threshold:
                            print(f"CROSS DEBUG: Crosses condition met - price {current_price} is very close to threshold {alert_value}")
                            is_triggered = True
                
                # Update last price for next check
                last_prices[f"{symbol}_{alert['id']}"] = current_price
                
                if is_triggered:
                    print(f"CROSS DEBUG: Alert triggered! {symbol} {alert['condition']} {alert_value}")
                    alert["status"] = "triggered"
                    if alert["notifyDiscord"]:
                        # Format condition message
                        condition_display = "reached"
                        if alert["condition"] == "above":
                            condition_display = "risen above"
                        elif alert["condition"] == "below":
                            condition_display = "fallen below"
                        elif alert["condition"] == "crosses":
                            condition_display = "crossed"
                        
                        message = f"🚨 Alert triggered: {symbol} has {condition_display} {alert_value} (Current price: {current_price})"
                        await discord_service.send_message(message)
            except Exception as e:
                print(f"Error checking alert {alert['id']}: {str(e)}")
                import traceback
                traceback.print_exc()
                
        await asyncio.sleep(10)  # Check every 10 seconds

@app.on_event("startup")
async def startup_event():
    background_tasks = BackgroundTasks()
    background_tasks.add_task(check_alerts, background_tasks)

# API routes
@app.get("/api/candles")
async def get_candles(symbol: str, timeframe: str):
    try:
        return await exchange_service.get_candles(symbol, timeframe)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alerts", response_model=List[Alert])
async def get_alerts():
    return alerts

@app.post("/api/alerts", response_model=Alert)
async def create_alert(alert_data: AlertBase):
    new_alert = {
        **alert_data.dict(),
        "id": str(uuid.uuid4()),
        "created_at": datetime.now().isoformat(),
        "status": "active"
    }
    alerts.append(new_alert)
    return new_alert

@app.delete("/api/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    for i, alert in enumerate(alerts):
        if alert["id"] == alert_id:
            alerts.pop(i)
            return {"message": "Alert deleted successfully"}
    raise HTTPException(status_code=404, detail="Alert not found")

@app.put("/api/alerts/{alert_id}", response_model=Alert)
async def update_alert(alert_id: str, alert_data: AlertBase):
    for i, alert in enumerate(alerts):
        if alert["id"] == alert_id:
            # Keep the original id, created_at, and status
            updated_alert = {
                **alert_data.dict(),
                "id": alert_id,
                "created_at": alert["created_at"],
                "status": alert["status"]  # Preserve the alert's current status
            }
            # Replace the alert with the updated version
            alerts[i] = updated_alert
            return updated_alert
    
    # If we reach here, the alert wasn't found
    raise HTTPException(status_code=404, detail="Alert not found")

@app.get("/api/exchange/info")
async def get_exchange_info():
    try:
        return await exchange_service.get_exchange_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add new routes for verifying Discord connectivity and direct webhook access

@app.post("/api/verify-discord")
async def verify_discord_webhook(request: Request):
    """Test the Discord webhook connectivity directly"""
    try:
        request_data = await request.json()
        print(f"⚠️ DISCORD VERIFICATION REQUEST: {request_data}")
        
        # Check if Discord webhook URL is configured
        if not discord_service.webhook_url:
            print("⚠️ Discord webhook URL not configured")
            return JSONResponse(
                status_code=400,
                content={
                    "success": False, 
                    "message": "Discord webhook URL not configured. Please set the DISCORD_WEBHOOK_URL environment variable."
                }
            )
        
        webhook_url = discord_service.webhook_url
        print(f"⚠️ Using Discord webhook URL: {webhook_url[:20]}...")
        
        # Send a test message
        test_message = request_data.get("testMessage", "Discord webhook verification")
        timestamp = request_data.get("timestamp", datetime.now().isoformat())
        
        try:
            result = await discord_service.send_message(
                content=f"🔍 WEBHOOK TEST: {test_message} (Time: {timestamp})",
                embeds=[{
                    "title": "Discord Webhook Verification",
                    "description": "This is a test to verify that Discord webhook is properly configured.",
                    "color": 5814783,  # Light blue
                    "fields": [
                        {
                            "name": "Test Info",
                            "value": test_message,
                            "inline": True
                        },
                        {
                            "name": "Timestamp",
                            "value": timestamp,
                            "inline": True
                        }
                    ]
                }]
            )
            
            print(f"⚠️ Discord verification message sent successfully: {result}")
            return {
                "success": True, 
                "message": "Discord webhook verified successfully",
                "webhook": webhook_url[:20] + "..." if len(webhook_url) > 20 else webhook_url
            }
        except Exception as discord_error:
            print(f"⚠️ Error sending verification to Discord: {discord_error}")
            import traceback
            traceback.print_exc()
            return JSONResponse(
                status_code=500,
                content={
                    "success": False, 
                    "message": f"Failed to send verification to Discord: {str(discord_error)}",
                    "error": traceback.format_exc()
                }
            )
    except Exception as e:
        print(f"⚠️ Server error in Discord verification: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Server error: {str(e)}", "error": traceback.format_exc()}
        )

@app.post("/api/discord/send")
async def send_discord_direct(request: Request):
    """Send a message directly to Discord webhook"""
    try:
        message_data = await request.json()
        print(f"⚠️ DIRECT DISCORD MESSAGE REQUEST: {message_data}")
        
        content = message_data.get("content", "")
        embeds = message_data.get("embeds", [])
        
        # Send directly to Discord
        try:
            result = await discord_service.send_message(content=content, embeds=embeds)
            print(f"⚠️ Direct Discord message sent successfully: {result}")
            return {"success": True, "message": "Message sent to Discord successfully"}
        except Exception as discord_error:
            print(f"⚠️ Error sending direct message to Discord: {discord_error}")
            import traceback
            traceback.print_exc()
            return JSONResponse(
                status_code=500,
                content={
                    "success": False, 
                    "message": f"Failed to send message to Discord: {str(discord_error)}",
                    "error": traceback.format_exc()
                }
            )
    except Exception as e:
        print(f"⚠️ Server error in direct Discord message: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Server error: {str(e)}", "error": traceback.format_exc()}
        )

# Update the test-alert endpoint with better error handling and forced testing
@app.post("/api/test-alert")
async def send_test_alert(request: Request):
    try:
        # Get raw request body for debugging
        raw_body = await request.body()
        print(f"⚠️ Raw request body: {raw_body}")
        
        # Parse the request body
        alert_data = await request.json()
        print(f"⚠️ ALERT DEBUG - Received alert request: {alert_data}")
        
        # Force this to send even if not real alert (for testing)
        force_send = alert_data.get("forceSend", False)
        
        symbol = alert_data.get("symbol", "BTCUSDT")
        price = alert_data.get("price", 50000)
        
        # Get additional parameters
        is_real_alert = alert_data.get("isRealAlert", False) or force_send
        condition = alert_data.get("condition", "test")
        target_price = alert_data.get("targetPrice", None)
        custom_message = alert_data.get("message", None)
        
        # Check if Discord webhook URL is configured
        if not discord_service.webhook_url:
            print("⚠️ Discord webhook URL not configured")
            return JSONResponse(
                status_code=400,
                content={
                    "success": False, 
                    "message": "Discord webhook URL not configured. Please set the DISCORD_WEBHOOK_URL environment variable."
                }
            )
        
        print(f"⚠️ Using Discord webhook URL: {discord_service.webhook_url[:20]}...")
        
        # Create different messages for real alerts vs tests
        if is_real_alert:
            # Use custom message if provided
            if custom_message:
                content = custom_message
            else:
                # Format condition for display
                condition_display = "reached"
                if condition == "above":
                    condition_display = "risen above"
                elif condition == "below":
                    condition_display = "fallen below"
                elif condition == "crosses":
                    condition_display = "crossed"
                
                content = f"🚨 @everyone PRICE ALERT: {symbol} has {condition_display} {target_price}!"
            
            color = 16711680  # Red for real alerts
        else:
            content = f"🧪 Test Alert: {symbol} at price ${price}"
            color = 3447003  # Blue for test alerts
        
        print(f"⚠️ Sending message to Discord: {content}")
        
        # Try to send the message to Discord
        try:
            result = await discord_service.send_message(
                content=content,
                embeds=[{
                    "title": f"{symbol} Alert",
                    "description": f"{'Price alert triggered' if is_real_alert else 'Test notification'}",
                    "color": color,
                    "fields": [
                        {
                            "name": "Symbol",
                            "value": symbol,
                            "inline": True
                        },
                        {
                            "name": "Current Price",
                            "value": f"${price}",
                            "inline": True
                        },
                        # Add target price for real alerts
                        *([{
                            "name": "Target Price",
                            "value": f"${target_price}",
                            "inline": True
                        }] if target_price is not None else []),
                        # Add condition for real alerts
                        *([{
                            "name": "Condition",
                            "value": condition,
                            "inline": True
                        }] if is_real_alert else []),
                        {
                            "name": "Time",
                            "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "inline": False
                        }
                    ]
                }]
            )
            print(f"⚠️ Discord message sent successfully: {result}")
            return {"success": True, "message": f"Alert sent to Discord successfully"}
        except Exception as discord_error:
            print(f"⚠️ Error sending to Discord: {discord_error}")
            import traceback
            traceback.print_exc()
            return JSONResponse(
                status_code=500,
                content={
                    "success": False, 
                    "message": f"Failed to send message to Discord: {str(discord_error)}",
                    "error": traceback.format_exc()
                }
            )
    except Exception as e:
        print(f"⚠️ Server error in test-alert: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Server error: {str(e)}", "error": traceback.format_exc()}
        )

# Add a debugging endpoint to check environment variables
@app.get("/api/debug/env")
async def debug_env():
    """Endpoint to check environment variables (don't use in production)"""
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL", "Not found")
    # Mask the webhook token for security
    if webhook_url != "Not found":
        parts = webhook_url.split('/')
        if len(parts) > 5:
            parts[-1] = parts[-1][:5] + "..." if len(parts[-1]) > 8 else parts[-1]
            webhook_url = '/'.join(parts)
    
    return {
        "DISCORD_WEBHOOK_URL": webhook_url,
        "env_vars_loaded": bool(os.getenv("DISCORD_WEBHOOK_URL")),
        "dotenv_loaded": True
    }

# Add prices router
app.include_router(prices_router, prefix="/api/prices", tags=["prices"])

if __name__ == "__main__":
    import uvicorn
    # Use PORT environment variable provided by Render
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
