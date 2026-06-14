/**
 * Global cache management system for page data
 * Prevents unnecessary API calls when navigating between pages
 * Only fetches fresh data on explicit user refresh
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

type CacheData = {
  [key: string]: CacheEntry<any>;
};

class CacheManager {
  private cache: CacheData = {};
  private subscribers: Map<string, Set<() => void>> = new Map();

  /**
   * Get cached data if it exists and is fresh
   */
  get<T>(key: string): T | null {
    const entry = this.cache[key];
    if (!entry) return null;
    return entry.data as T;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
    };
    this.notifySubscribers(key);
  }

  /**
   * Check if cache entry exists
   */
  has(key: string): boolean {
    return key in this.cache;
  }

  /**
   * Clear a specific cache entry
   */
  clear(key: string): void {
    delete this.cache[key];
    this.notifySubscribers(key);
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache = {};
    this.subscribers.forEach(subscribers => {
      subscribers.forEach(callback => callback());
    });
  }

  /**
   * Subscribe to cache changes for a specific key
   */
  subscribe(key: string, callback: () => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Notify all subscribers of a cache change
   */
  private notifySubscribers(key: string): void {
    this.subscribers.get(key)?.forEach(callback => callback());
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats() {
    return {
      cacheSize: Object.keys(this.cache).length,
      keys: Object.keys(this.cache),
    };
  }
}

// Single global cache instance
export const globalCache = new CacheManager();

/**
 * Generate a cache key from route and parameters
 */
export function generateCacheKey(
  route: string,
  params?: Record<string, any>
): string {
  if (!params || Object.keys(params).length === 0) {
    return route;
  }
  const paramStr = JSON.stringify(params);
  return `${route}:${paramStr}`;
}

/**
 * Invalidate cache by pattern (e.g., "home:*" for all home page caches)
 */
export function invalidateCachePattern(pattern: string): void {
  const regex = new RegExp(`^${pattern.replace('*', '.*')}`);
  Object.keys(globalCache['cache']).forEach(key => {
    if (regex.test(key)) {
      globalCache.clear(key);
    }
  });
}
