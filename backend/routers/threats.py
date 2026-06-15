from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
import asyncio

from dependencies import get_settings_dep, verify_api_key
from config import Settings
from models.threat import FalcoEvent
from services.threat_service import ThreatService

router = APIRouter()

@router.post("/falco")
async def falco_webhook(
	event: FalcoEvent,
	settings: Settings = Depends(verify_api_key)
) -> dict:
    """Receive Falco events (JSON) from webhook and publish to Redis channel.
    
    Requires X-API-Key header.
    """
    service = ThreatService(settings)
    await service.publish_falco_event(event)
    return {"status": "ok"}


@router.websocket("/ws/threats")
async def ws_threats(ws: WebSocket, settings: Settings = Depends(get_settings_dep)):
    """WebSocket endpoint for real-time threat events.
    
    Query param: ?api_key=YOUR_API_KEY
    """
    # Get API key from query params
    query_params = ws.query_params
    api_key = query_params.get("api_key")
    
    if not api_key or api_key != settings.API_KEY:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid API key")
        return
    
    await ws.accept()
    service = ThreatService(settings)
    pubsub = None
    try:
        pubsub = await service.subscribe_events()
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("type") == "message":
                payload = message.get("data")
                if isinstance(payload, bytes):
                    payload = payload.decode()
                await ws.send_text(payload)

            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass
    finally:
        if pubsub:
            try:
                await pubsub.unsubscribe("falco:events")
                await pubsub.close()
            except Exception:
                pass
