import { useEffect, useState, useCallback } from 'react';
import { useCache } from '@/providers/CacheProvider';

/**
 * Hook to cache and retrieve page data with automatic restoration
 * Prevents re-fetching when navigating back to a previously visited page
 * Only fetches fresh data on explicit user refresh or when cache is cleared
 */
export function useCachedPageData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: {
    skipCache?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    ttl?: number; // Time to live in milliseconds (optional)
  }
) {
  const cache = useCache();
  const [data, setData] = useState<T | null>(() => {
    if (!options?.skipCache) {
      return cache.getCached<T>(cacheKey);
    }
    return null;
  });
  const [loading, setLoading] = useState(!data && !cache.hasCached(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(
    async (skipCache = false) => {
      // If we have cached data and not forcing refresh, use it
      if (!skipCache && data !== null) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchFn();
        cache.setCached(cacheKey, result);
        setData(result);
        options?.onSuccess?.(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options?.onError?.(error);
      } finally {
        setLoading(false);
      }
    },
    [cacheKey, data, cache, options]
  );

  // Load from cache on mount
  useEffect(() => {
    if (!options?.skipCache) {
      const cachedData = cache.getCached<T>(cacheKey);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        return;
      }
    }

    // Only fetch if no cached data
    if (data === null) {
      fetch(false);
    }
  }, [cacheKey, cache, options?.skipCache, data, fetch]);

  return {
    data,
    loading,
    error,
    refresh: () => fetch(true), // Force refresh by skipping cache
    clearCache: () => cache.clearCache(cacheKey),
  };
}
