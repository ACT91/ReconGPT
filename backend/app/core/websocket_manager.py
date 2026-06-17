import json
from typing import Dict, List, Set, Any, Optional
from uuid import UUID
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from app.core.config import settings
from app.core.logger import get_logger
import redis.asyncio as redis

logger = get_logger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[str]] = {}
        self.job_subscribers: Dict[str, List[WebSocket]] = {}
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
        self._pubsub_task: Optional[asyncio.Task] = None

    async def connect_redis(self):
        try:
            self.redis_client = redis.from_url(str(settings.REDIS_URL), socket_connect_timeout=3)
            await self.redis_client.ping()
            self.pubsub = self.redis_client.pubsub()
            await self.pubsub.subscribe("scan_updates")
            self._pubsub_task = asyncio.create_task(self._listen_for_updates())
            logger.info("websocket_redis_connected")
        except Exception as e:
            logger.warning("websocket_redis_unavailable", error=str(e))
            self.redis_client = None
            self.pubsub = None

    async def _listen_for_updates(self):
        if not self.pubsub:
            return
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    await self._broadcast_update(message["data"])
        except Exception as e:
            logger.error("pubsub_error", error=str(e))

    async def _broadcast_update(self, data: bytes):
        try:
            payload = json.loads(data)
            job_id = payload.get("job_id")
            if job_id and job_id in self.job_subscribers:
                disconnected = []
                for ws in self.job_subscribers[job_id]:
                    try:
                        await ws.send_text(json.dumps(payload))
                    except WebSocketDisconnect:
                        disconnected.append(ws)
                for ws in disconnected:
                    self.job_subscribers[job_id].remove(ws)
        except Exception as e:
            logger.error("broadcast_error", error=str(e))

    async def connect_job(self, websocket: WebSocket, job_id: UUID):
        await websocket.accept()
        job_id_str = str(job_id)
        if job_id_str not in self.job_subscribers:
            self.job_subscribers[job_id_str] = []
        self.job_subscribers[job_id_str].append(websocket)
        logger.debug("websocket_connected", job_id=str(job_id))

    async def disconnect_job(self, websocket: WebSocket, job_id: UUID):
        job_id_str = str(job_id)
        if job_id_str in self.job_subscribers:
            try:
                self.job_subscribers[job_id_str].remove(websocket)
            except ValueError:
                pass
        logger.debug("websocket_disconnected", job_id=str(job_id))

    async def broadcast_progress(self, job_id: UUID, stage: str, progress: float, message: str = None):
        payload = {
            "job_id": str(job_id),
            "type": "progress",
            "stage": stage,
            "progress": progress,
            "message": message,
            "timestamp": asyncio.get_event_loop().time(),
        }
        if self.redis_client:
            await self.redis_client.publish("scan_updates", json.dumps(payload))

    async def broadcast_log(
        self,
        job_id: UUID,
        stage: str,
        level: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ):
        payload = {
            "job_id": str(job_id),
            "type": "log",
            "stage": stage,
            "level": level,
            "message": message,
            "details": details,
            "timestamp": asyncio.get_event_loop().time(),
        }
        if self.redis_client:
            await self.redis_client.publish("scan_updates", json.dumps(payload))

    async def broadcast_status(self, job_id: UUID, status: str, error: str = None):
        payload = {
            "job_id": str(job_id),
            "type": "status",
            "status": status,
            "error": error,
            "timestamp": asyncio.get_event_loop().time(),
        }
        if self.redis_client:
            await self.redis_client.publish("scan_updates", json.dumps(payload))


manager = ConnectionManager()


async def broadcast_pipeline_event(
    job_id: UUID,
    event_type: str,
    data: Dict[str, Any],
):
    payload = {
        "job_id": str(job_id),
        "type": event_type,
        "data": data,
        "timestamp": asyncio.get_event_loop().time(),
    }
    if manager.redis_client:
        await manager.redis_client.publish("scan_updates", json.dumps(payload))


async def emit_stage_progress(
    job_id: UUID,
    stage: str,
    progress: float,
    message: Optional[str] = None,
):
    await manager.broadcast_progress(job_id, stage, progress, message)


async def emit_stage_log(
    job_id: UUID,
    stage: str,
    level: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
):
    await manager.broadcast_log(job_id, stage, level, message, details)