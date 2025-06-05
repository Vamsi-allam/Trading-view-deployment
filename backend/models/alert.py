from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

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

class Alert(AlertBase):
    id: str
    created_at: datetime
    status: str = "active"

class AlertResponse(Alert):
    pass
