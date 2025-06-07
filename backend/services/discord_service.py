import aiohttp
import os
from typing import Dict, Any, Optional
import logging
import datetime
import time
import json
import traceback

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("discord_service")

class DiscordService:
    def __init__(self):
        # Try to get from env, or use hardcoded value as fallback
        self.webhook_url = os.getenv("DISCORD_WEBHOOK_URL", "")
        
        # If still not set, use the hardcoded value
        if not self.webhook_url:
            self.webhook_url = "https://discord.com/api/webhooks/1347636744685748415/iyfjO_p8gLuD2yCu8zxd5_9mx9gqclVJ8x5NC1uYz6paJhGNn8CnIk7LxSTBrPBLcsdn"
            logger.warning("Using hardcoded webhook URL as fallback")
        
        # Add a deduplication cache to prevent sending duplicate alerts
        self.recent_alerts = {}
        self.dedup_window = 5  # seconds to prevent duplicate alerts
        
        # Log webhook URL for debugging
        masked_url = self.webhook_url[:20] + "..." if self.webhook_url else "None"
        logger.info(f"Discord webhook URL: {masked_url}")
        
    async def send_message(self, content: str, embeds: Optional[list] = None) -> Dict[str, Any]:
        """
        Send a message to Discord using a webhook
        
        Args:
            content: The message content
            embeds: Optional list of embed objects
            
        Returns:
            Response from Discord API
        """
        if not self.webhook_url:
            logger.error("⚠️ Discord webhook URL not configured")
            raise ValueError("Discord webhook URL not configured. Please set the DISCORD_WEBHOOK_URL environment variable.")
        
        # Create a message signature for deduplication
        message_sig = f"{content}:{str(embeds)}"
        current_time = time.time()
        
        # Check if this is a duplicate message within the deduplication window
        if message_sig in self.recent_alerts:
            last_sent = self.recent_alerts[message_sig]
            if current_time - last_sent < self.dedup_window:
                logger.warning(f"⚠️ Duplicate alert detected and prevented (within {self.dedup_window}s window)")
                return {"success": True, "info": "Duplicate alert prevented"}
        
        # Store this message in recent alerts cache
        self.recent_alerts[message_sig] = current_time
        
        # Clean up old entries from the cache (older than 30 seconds)
        self.recent_alerts = {k: v for k, v in self.recent_alerts.items() 
                             if current_time - v < 30}
                
        logger.info(f"⚠️ Sending Discord message: {content[:50]}...")
            
        payload = {"content": content}
        if embeds:
            payload["embeds"] = embeds
            
        try:
            # Log more detailed information for debugging
            masked_url = self.webhook_url[:20] + "..." if self.webhook_url else "None"
            logger.info(f"⚠️ Webhook URL being used: {masked_url}")
            logger.info(f"⚠️ Payload being sent: {json.dumps(payload)[:200]}...")
            
            timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    self.webhook_url, 
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    response_text = await response.text()
                    logger.info(f"⚠️ Discord response status: {response.status}")
                    logger.info(f"⚠️ Discord response text: {response_text}")
                    
                    if response.status not in [200, 204]:
                        logger.error(f"⚠️ Discord webhook failed: {response_text}")
                        # Print more detailed error information
                        logger.error(f"⚠️ Request details: URL={masked_url}, Headers={session.headers}")
                        raise Exception(f"Discord webhook failed with status {response.status}: {response_text}")
                        
                    if response.status == 204:  # Discord returns 204 No Content on success
                        logger.info("⚠️ Discord message sent successfully (204 No Content)")
                        return {"success": True}
                        
                    logger.info("⚠️ Discord message sent successfully")
                    return await response.json()
        except aiohttp.ClientError as e:
            logger.error(f"⚠️ Network error when sending to Discord: {str(e)}")
            logger.error(f"⚠️ Stack trace: {traceback.format_exc()}")
            raise Exception(f"Network error when sending to Discord: {str(e)}")
        except Exception as e:
            logger.error(f"⚠️ Unexpected error sending to Discord: {str(e)}")
            logger.error(f"⚠️ Stack trace: {traceback.format_exc()}")
            raise
                
    async def send_alert(self, symbol: str, alert_type: str, condition: str, value: str, current_price: float) -> Dict[str, Any]:
        """
        Send a formatted alert to Discord
        
        Args:
            symbol: Trading pair symbol
            alert_type: Type of alert (price, volume, etc.)
            condition: Alert condition (above, below, etc.)
            value: Trigger value
            current_price: Current price when alert triggered
            
        Returns:
            Response from Discord API
        """
        try:
            # Generate a unique alert ID for this specific alert
            alert_id = f"{symbol}_{alert_type}_{condition}_{value}_{current_price}"
            logger.info(f"Processing alert ID: {alert_id}")
            
            # Ensure current_price is a float
            current_price_float = float(current_price)
            
            # Format ISO timestamp for Discord
            timestamp = datetime.datetime.utcnow().isoformat()
            
            # Create a more detailed embed with better formatting
            embed = {
                "title": f"🚨 Trading Alert: {symbol}",
                "description": f"An alert has been triggered for {symbol}!",
                "color": 16711680,  # Red color
                "fields": [
                    {
                        "name": "Alert Type",
                        "value": alert_type.capitalize(),
                        "inline": True
                    },
                    {
                        "name": "Condition",
                        "value": condition.capitalize(),
                        "inline": True
                    },
                    {
                        "name": "Trigger Value",
                        "value": f"${value}",
                        "inline": True
                    },
                    {
                        "name": "Current Price",
                        "value": f"${current_price_float:.2f}",
                        "inline": True
                    },
                    {
                        "name": "Triggered At",
                        "value": f"<t:{int(time.time())}:F>",
                        "inline": False
                    }
                ],
                "timestamp": timestamp,
                "footer": {
                    "text": "Trading Bot Alert System"
                }
            }
            
            logger.info(f"Sending alert to Discord for {symbol}, embed: {json.dumps(embed)[:200]}...")
            
            # Send the alert with @everyone mention to ensure notifications
            return await self.send_message(
                content=f"@everyone Trading alert triggered for {symbol}!",
                embeds=[embed]
            )
        except Exception as e:
            logger.error(f"Error formatting alert: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            # Try to send a simple message as fallback
            try:
                return await self.send_message(
                    content=f"@everyone Trading alert for {symbol}: {condition} {value} (current: {current_price})"
                )
            except:
                logger.error("Failed to send fallback alert message")
                raise
