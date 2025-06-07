from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from services.exchange_service import ExchangeService
import asyncio
import logging
import random
from datetime import datetime
import time

router = APIRouter()
logger = logging.getLogger("prices_router")

# Add a price cache at the module level to provide fallbacks
price_cache = {}

# Track the last log time to reduce logging frequency
_last_log_time = {}
_LOG_INTERVAL = 30  # seconds between logging similar events
_request_count = {}  # Track request count per symbol

def should_log(symbol):
    """Determine if we should log this event based on time since last log and count"""
    now = time.time()
    
    # Update request counter
    _request_count[symbol] = _request_count.get(symbol, 0) + 1
    
    # Log based on combination of time and count
    if (symbol not in _last_log_time or 
            (now - _last_log_time[symbol]) > _LOG_INTERVAL or
            _request_count[symbol] % 20 == 0):  # Log every 20th request even if within time window
        _last_log_time[symbol] = now
        return True
    return False

@router.get("/{symbol}")
async def get_price(symbol: str):
    """Get current price for a symbol"""
    try:
        if should_log(symbol):
            logger.info(f"Fetching price for {symbol}")
        
        exchange_service = ExchangeService()
        price = await exchange_service.get_current_price(symbol)
        
        # Cache the successful price
        price_cache[symbol] = price
        
        if should_log(symbol):
            logger.info(f"Price for {symbol}: {price}")
        
        return {"symbol": symbol, "price": price}
    except Exception as e:
        logger.error(f"Error fetching price for {symbol}: {str(e)}")
        
        # Try to use cached price if available
        if symbol in price_cache:
            logger.warning(f"Using cached price for {symbol}: {price_cache[symbol]}")
            return {"symbol": symbol, "price": price_cache[symbol], "cached": True}
            
        # Generate mock data as last resort
        fallback_prices = {
            'BTCUSDT': 65000.0,
            'ETHUSDT': 3500.0,
            'SOLUSDT': 140.0,
            'BNBUSDT': 580.0,
            'XRPUSDT': 0.55,
            'DOGEUSDT': 0.12,
        }
        
        # Add some randomness to the fallback price
        base_price = fallback_prices.get(symbol, 100.0)
        variation = random.uniform(-0.005, 0.005)  # ±0.5% variation
        fallback_price = base_price * (1 + variation)
        
        logger.warning(f"Using fallback price for {symbol}: {fallback_price}")
        return {"symbol": symbol, "price": fallback_price, "fallback": True}

# WebSocket connection manager with improved error handling
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}
        self.price_cache = {}
        
    async def connect(self, websocket: WebSocket, symbol: str):
        await websocket.accept()
        if symbol not in self.active_connections:
            self.active_connections[symbol] = []
        self.active_connections[symbol].append(websocket)
        
    def disconnect(self, websocket: WebSocket, symbol: str):
        if symbol in self.active_connections:
            try:
                self.active_connections[symbol].remove(websocket)
            except ValueError:
                pass  # Already removed
            
    async def broadcast(self, symbol: str, data: dict):
        if symbol in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[symbol]:
                try:
                    await connection.send_json(data)
                except Exception as e:
                    logger.error(f"Error sending data to client: {str(e)}")
                    dead_connections.append(connection)
            
            # Clean up dead connections
            for dead in dead_connections:
                try:
                    self.active_connections[symbol].remove(dead)
                except ValueError:
                    pass  # Already removed

manager = ConnectionManager()

@router.websocket("/ws/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    await manager.connect(websocket, symbol)
    exchange_service = ExchangeService()
    
    # Send initial price immediately upon connection
    try:
        price = await exchange_service.get_current_price(symbol)
        await manager.broadcast(symbol, {"symbol": symbol, "price": price})
    except Exception as e:
        logger.error(f"Error fetching initial price for {symbol}: {str(e)}")
        # Use fallback
        fallback_price = 65000.0 if symbol == "BTCUSDT" else 3500.0 if symbol == "ETHUSDT" else 100.0
        await manager.broadcast(symbol, {"symbol": symbol, "price": fallback_price, "fallback": True})
    
    try:
        while True:
            try:
                price = await exchange_service.get_current_price(symbol)
                manager.price_cache[symbol] = price
                await manager.broadcast(symbol, {"symbol": symbol, "price": price})
            except Exception as e:
                logger.error(f"Error in websocket for {symbol}: {str(e)}")
                # Use cached price if available
                if symbol in manager.price_cache:
                    await manager.broadcast(symbol, {
                        "symbol": symbol, 
                        "price": manager.price_cache[symbol], 
                        "cached": True
                    })
                else:
                    # Generate fallback price
                    fallback_price = 65000.0 if symbol == "BTCUSDT" else 3500.0 if symbol == "ETHUSDT" else 100.0
                    variation = random.uniform(-0.005, 0.005)  # ±0.5% variation
                    await manager.broadcast(symbol, {
                        "symbol": symbol, 
                        "price": fallback_price * (1 + variation), 
                        "fallback": True
                    })
            
            await asyncio.sleep(1)  # Update every second
    except WebSocketDisconnect:
        manager.disconnect(websocket, symbol)
