interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

// Listen for broadcast channel updates in browser
if (typeof window !== 'undefined') {
  try {
    const channel = new BroadcastChannel('reliefchain_sync');
    channel.onmessage = (event) => {
      if (event.data?.type === 'CACHE_INVALIDATED') {
        const keyOrPrefix = event.data.keyOrPrefix;
        if (!keyOrPrefix) {
          memoryCache.clear();
        } else {
          for (const key of memoryCache.keys()) {
            if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
              memoryCache.delete(key);
            }
          }
        }
        window.dispatchEvent(new CustomEvent('reliefchain_cache_cleared', { detail: { keyOrPrefix } }));
      }
    };

    window.addEventListener('storage', (e) => {
      if (e.key === 'reliefchain_last_mutation') {
        memoryCache.clear();
        window.dispatchEvent(new CustomEvent('reliefchain_cache_cleared', { detail: {} }));
      }
    });
  } catch {}
}

/**
 * Retrieve cached data if present (even if slightly stale for SWR)
 */
export function getCachedData<T>(key: string, maxAgeMs = 15000): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp <= maxAgeMs) {
    return entry.data;
  }
  return entry.data;
}

/**
 * Check if the cache entry is completely fresh (no revalidation needed)
 */
export function isCacheFresh(key: string, freshAgeMs = 3000): boolean {
  const entry = memoryCache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp <= freshAgeMs;
}

/**
 * Save data into the memory cache
 */
export function setCachedData<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalidate cache by key or prefix and synchronize across all tabs/windows
 */
export function invalidateCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    memoryCache.clear();
  } else {
    for (const key of memoryCache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        memoryCache.delete(key);
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('reliefchain_cache_cleared', { detail: { keyOrPrefix } }));
    try {
      const channel = new BroadcastChannel('reliefchain_sync');
      channel.postMessage({ type: 'CACHE_INVALIDATED', keyOrPrefix, timestamp: Date.now() });
      channel.close();
    } catch {}
    try {
      localStorage.setItem('reliefchain_last_mutation', String(Date.now()));
    } catch {}
  }
}

/**
 * Subscribe to cache invalidation and window focus events to automatically refresh view
 */
export function subscribeToCacheInvalidation(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleClear = () => callback();
  const handleFocus = () => callback();

  window.addEventListener('reliefchain_cache_cleared', handleClear);
  window.addEventListener('focus', handleFocus);

  return () => {
    window.removeEventListener('reliefchain_cache_cleared', handleClear);
    window.removeEventListener('focus', handleFocus);
  };
}
