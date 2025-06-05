import aiohttp
import os
from typing import Dict, Any, Optional
import logging

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
        
        logger.info(f"Discord webhook URL: {self.webhook_url[:20]}...")
        
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
        
        logger.info(f"⚠️ Sending Discord message: {content[:50]}...")
            
        payload = {"content": content}
        if embeds:
            payload["embeds"] = embeds
            
        try:
            logger.info(f"⚠️ Webhook URL being used: {self.webhook_url[:20]}...")
            logger.info(f"⚠️ Payload being sent: {str(payload)[:200]}...")
            
            async with aiohttp.ClientSession() as session:
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
                        raise Exception(f"Discord webhook failed with status {response.status}: {response_text}")
                        
                    if response.status == 204:  # Discord returns 204 No Content on success
                        logger.info("⚠️ Discord message sent successfully (204 No Content)")
                        return {"success": True}
                        
                    logger.info("⚠️ Discord message sent successfully")
                    return await response.json()
        except aiohttp.ClientError as e:
            logger.error(f"⚠️ Network error when sending to Discord: {str(e)}")
            raise Exception(f"Network error when sending to Discord: {str(e)}")
                
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
        embed = {
            "title": f"🚨@everyone Trading Alert: {symbol}",
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
                    "value": value,
                    "inline": True
                },
                {
                    "name": "Current Price",
                    "value": str(current_price),
                    "inline": True
                }
            ],
            "timestamp": "now"  # Discord automatically formats this
        }
        
        return await self.send_message(
            content=f"Trading alert triggered for {symbol}!",
            embeds=[embed]
        )
