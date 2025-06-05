from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.exchange_service import ExchangeService
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}
        self.exchange_service = ExchangeService()

    async def connect(self, websocket: WebSocket, symbol: str):
        await websocket.accept()
        if symbol not in self.active_connections:
            self.active_connections[symbol] = []
        self.active_connections[symbol].append(websocket)

    def disconnect(self, websocket: WebSocket, symbol: str):
        if symbol in self.active_connections:
            self.active_connections[symbol].remove(websocket)

    async def broadcast_price(self, symbol: str, price: float):
        if symbol in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[symbol]:
                try:
                    await connection.send_json({"symbol": symbol, "price": price})
                except:
                    dead_connections.append(connection)
            
            # Clean up dead connections
            for dead in dead_connections:
                self.active_connections[symbol].remove(dead)

manager = ConnectionManager()

@router.get("/{symbol}")
async def get_price(symbol: str):
    """Get current price for a symbol"""
    try:
        price = await manager.exchange_service.get_current_price(symbol)
        return {"symbol": symbol, "price": price}
    except Exception as e:
        logger.error(f"Error fetching price for {symbol}: {str(e)}")
        raise

@router.websocket("/ws/prices/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    await manager.connect(websocket, symbol)
    try:
        while True:
            try:
                price = await manager.exchange_service.get_current_price(symbol)
                await manager.broadcast_price(symbol, price)
                await asyncio.sleep(1)  # Update every second
            except Exception as e:
                logger.error(f"Error in price feed for {symbol}: {str(e)}")
                await asyncio.sleep(5)  # Wait before retrying
    except WebSocketDisconnect:
        manager.disconnect(websocket, symbol)
