import time
from typing import Optional
from fastapi import Request, HTTPException, status
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

class _RedisState:
    available: Optional[bool] = None

_redis_state = _RedisState()


async def _get_redis():
    try:
        import redis.asyncio as redis
        client = redis.from_url(str(settings.REDIS_URL), socket_connect_timeout=2)
        await client.ping()
        _redis_state.available = True
        return client
    except Exception as e:
        if _redis_state.available is not False:
            logger.warning("rate_limit_redis_unavailable", error=str(e))
            _redis_state.available = False
        return None


class NoopRateLimiter:
    async def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        return True, max_requests

    async def acquire_slot(self, key: str, max_concurrent: int) -> tuple[bool, int]:
        return True, max_concurrent


class RateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client

    async def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        try:
            now = int(time.time())
            window_start = now - window_seconds
            pipe = self.redis.pipeline()
            pipe.zadd(key, {str(now): now})
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zcard(key)
            results = await pipe.execute()
            current_count = results[2]
            return current_count <= max_requests, max_requests - current_count
        except Exception as e:
            logger.warning("rate_limit_check_failed", error=str(e))
            return True, max_requests

    async def acquire_slot(self, key: str, max_concurrent: int) -> tuple[bool, int]:
        try:
            now = int(time.time())
            pipe = self.redis.pipeline()
            pipe.zadd(key, {str(now): now})
            pipe.zremrangebyscore(key, 0, now - 3600)
            pipe.zcard(key)
            results = await pipe.execute()
            current_count = results[1]
            if current_count > max_concurrent:
                pipe2 = self.redis.pipeline()
                pipe2.zrem(key, str(now))
                await pipe2.execute()
                return False, max_concurrent
            return True, max_concurrent - current_count + 1
        except Exception as e:
            logger.warning("rate_limit_acquire_failed", error=str(e))
            return True, max_concurrent


async def check_rate_limit(
    user_id: str,
    action: str = "default",
    max_requests: Optional[int] = None,
    window_seconds: Optional[int] = None,
) -> tuple[bool, int]:
    client = await _get_redis()
    if not client:
        return True, (max_requests or settings.RATE_LIMIT_REQUESTS)
    limiter = RateLimiter(client)
    key = f"rate_limit:user:{user_id}:{action}"
    max_req = max_requests or settings.RATE_LIMIT_REQUESTS
    window = window_seconds or settings.RATE_LIMIT_WINDOW_SECONDS
    result = await limiter.is_allowed(key, max_req, window)
    await client.close()
    return result


async def check_concurrent_scans(user_id: str) -> tuple[bool, int]:
    client = await _get_redis()
    if not client:
        return True, settings.MAX_CONCURRENT_SCANS_PER_USER
    limiter = RateLimiter(client)
    key = f"concurrent_scans:{user_id}"
    result = await limiter.acquire_slot(key, settings.MAX_CONCURRENT_SCANS_PER_USER)
    await client.close()
    return result