from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from services.exchange_service import ExchangeService
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger("prices_router")

@router.get("/{symbol}")
async def get_price(symbol: str):
    """Get current price for a symbol"""
    try:
        logger.info(f"Fetching price for {symbol}")
        exchange_service = ExchangeService()
        price = await exchange_service.get_current_price(symbol)
        logger.info(f"Price for {symbol}: {price}")
        return {"symbol": symbol, "price": price}
    except Exception as e:
        logger.error(f"Error fetching price for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch price: {str(e)}")

# Websocket connection for real-time price updates
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}
        
    async def connect(self, websocket: WebSocket, symbol: str):
        await websocket.accept()
        if symbol not in self.active_connections:
            self.active_connections[symbol] = []
        self.active_connections[symbol].append(websocket)
        
    def disconnect(self, websocket: WebSocket, symbol: str):
        if symbol in self.active_connections:
            self.active_connections[symbol].remove(websocket)
            
    async def broadcast(self, symbol: str, data: dict):
        if symbol in self.active_connections:
            for connection in self.active_connections[symbol]:
                try:
                    await connection.send_json(data)
                except Exception:
                    # Connection might have been closed
                    await self.disconnect(connection, symbol)

manager = ConnectionManager()

@router.websocket("/ws/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    await manager.connect(websocket, symbol)
    exchange_service = ExchangeService()
    try:
        while True:
            try:
                price = await exchange_service.get_current_price(symbol)
                await manager.broadcast(symbol, {"symbol": symbol, "price": price})
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Error in websocket for {symbol}: {str(e)}")
                await asyncio.sleep(5)  # Wait before retrying
    except WebSocketDisconnect:
        manager.disconnect(websocket, symbol)
