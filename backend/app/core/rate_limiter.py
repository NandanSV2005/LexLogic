import os
import time
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status

class SlidingWindowRateLimiter:
    """Lightweight in-memory sliding window rate limiter for production MVP deployments.
    
    Tracks client IP request timestamps per endpoint category.
    """

    def __init__(self, max_requests: int = 15, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Storage format: { client_ip: [timestamp1, timestamp2, ...] }
        self.history: Dict[str, List[float]] = {}

    def is_rate_limited(self, client_ip: str) -> Tuple[bool, int]:
        if os.environ.get("DISABLE_RATE_LIMIT") == "1":
            return False, 0

        now = time.time()
        window_start = now - self.window_seconds


        # Clean old timestamps
        timestamps = self.history.get(client_ip, [])
        valid_timestamps = [ts for ts in timestamps if ts > window_start]
        self.history[client_ip] = valid_timestamps

        if len(valid_timestamps) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - valid_timestamps[0]))
            return True, max(retry_after, 1)

        valid_timestamps.append(now)
        return False, 0

    def reset(self) -> None:
        """Reset rate limiter state (useful for test fixtures)."""
        self.history.clear()


# Default Rate Limiter instances
auth_rate_limiter = SlidingWindowRateLimiter(max_requests=100, window_seconds=60)
upload_rate_limiter = SlidingWindowRateLimiter(max_requests=200, window_seconds=60)



async def check_auth_rate_limit(request: Request) -> None:
    """Dependency checking rate limits on login/register endpoints."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    limited, retry_after = auth_rate_limiter.is_rate_limited(client_ip)
    if limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for authentication requests. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )


async def check_upload_rate_limit(request: Request) -> None:
    """Dependency checking rate limits on document upload endpoints."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    limited, retry_after = upload_rate_limiter.is_rate_limited(client_ip)
    if limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for document uploads. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )
