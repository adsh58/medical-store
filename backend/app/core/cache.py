import time
from typing import Any, Dict, Optional
import threading

class SimpleCache:
    def __init__(self, default_ttl: int = 300):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                if entry["expiry"] > time.time():
                    return entry["value"]
                else:
                    del self._cache[key]
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        with self._lock:
            expiry = time.time() + (ttl if ttl is not None else self.default_ttl)
            self._cache[key] = {"value": value, "expiry": expiry}

    def delete(self, key_prefix: str) -> None:
        with self._lock:
            keys_to_del = [k for k in self._cache.keys() if k.startswith(key_prefix)]
            for k in keys_to_del:
                if k in self._cache:
                    del self._cache[k]

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

query_cache = SimpleCache(default_ttl=300)  # Default 5 minutes TTL
