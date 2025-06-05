# Add this import and router registration to your main FastAPI app file
# The exact location depends on your current structure

# Add this with your other imports
from fastapi import FastAPI
from routes.alerts import router as alerts_router
from routes.discord import router as discord_router

app = FastAPI()

# Add this with your other router registrations
app.include_router(alerts_router, prefix="/api/alerts", tags=["alerts"])
app.include_router(discord_router, prefix="/api/discord", tags=["discord"])

# If you already have an alerts router, you need to add the new endpoints to it
