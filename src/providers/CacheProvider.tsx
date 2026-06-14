'use client';

import React, { createContext, useContext, useCallback, useRef } from 'react';
import { globalCache, generateCacheKey } from '@/lib/cache-utils';

interface CacheContextType {
  getCached<T>(key: string): T | null;
  setCached<T>(key: string, data: T): void;
  hasCached(key: string): boolean;
  clearCache(key: string): void;
  clearAllCache(): void;
  generateKey(route: string, params?: Record<string, any>): string;
  subscribeCacheChange(key: string, callback: () => void): () => void;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export function CacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<CacheContextType>({
    getCached: (key: string) => {
      return globalCache.get(key);
    },
    setCached: (key: string, data: any) => {
      globalCache.set(key, data);
    },
    hasCached: (key: string) => {
      return globalCache.has(key);
    },
    clearCache: (key: string) => {
      globalCache.clear(key);
    },
    clearAllCache: () => {
      globalCache.clearAll();
    },
    generateKey: (route: string, params?: Record<string, any>) => {
      return generateCacheKey(route, params);
    },
    subscribeCacheChange: (key: string, callback: () => void) => {
      return globalCache.subscribe(key, callback);
    },
  });

  return (
    <CacheContext.Provider value={cacheRef.current}>
      {children}
    </CacheContext.Provider>
  );
}

/**
 * Hook to use the cache context
 */
export function useCache(): CacheContextType {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}

/**
 * Hook to cache and retrieve data for a specific route
 * Automatically uses cache on mount, only fetches on explicit refresh
 */
export function useCachedData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: {
    skipCache?: boolean;
    onSuccess?: (data: T) => void;
  }
) {
  const cache = useCache();
  const [data, setData] = React.useState<T | null>(() => {
    if (!options?.skipCache) {
      return cache.getCached<T>(cacheKey);
    }
    return null;
  });
  const [loading, setLoading] = React.useState(!data && !cache.hasCached(cacheKey));
  const [error, setError] = React.useState<Error | null>(null);

  const fetch = useCallback(async (skipCache = false) => {
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
    } finally {
      setLoading(false);
    }
  }, [cacheKey, data, cache, options]);

  // Load from cache on mount
  React.useEffect(() => {
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
  };
}
