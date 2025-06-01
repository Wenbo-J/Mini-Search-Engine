import { useState, useCallback, useEffect } from 'react';

export interface GlobalMetrics {
  avgLatencyMs: number | null;
  cacheHitRate: number | null;
  rawMetricsText: string | null; // For debugging or more complex parsing if needed
}

interface UseGlobalMetricsResult extends GlobalMetrics {
  loading: boolean;
  error: Error | null;
  fetchMetrics: () => Promise<void>;
}

// Helper function to parse Prometheus text format for specific metrics
const parsePrometheusMetrics = (text: string): GlobalMetrics => {
  let latencySum: number | null = null;
  let latencyCount: number | null = null;
  let cacheHits: number | null = null;
  let cacheMisses: number | null = null;

  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;

    if (line.startsWith('search_request_latency_seconds_sum')) {
      latencySum = parseFloat(line.split(' ')[1]);
    } else if (line.startsWith('search_request_latency_seconds_count')) {
      latencyCount = parseFloat(line.split(' ')[1]);
    } else if (line.startsWith('search_cache_hits_total')) {
      cacheHits = parseFloat(line.split(' ')[1]);
    } else if (line.startsWith('search_cache_misses_total')) {
      cacheMisses = parseFloat(line.split(' ')[1]);
    }
  }

  let avgLatencyMs: number | null = null;
  if (latencySum !== null && latencyCount !== null && latencyCount > 0) {
    avgLatencyMs = (latencySum / latencyCount) * 1000;
  }

  let cacheHitRate: number | null = null;
  if (cacheHits !== null && cacheMisses !== null) {
    const totalAccesses = cacheHits + cacheMisses;
    if (totalAccesses > 0) {
      cacheHitRate = cacheHits / totalAccesses;
    }
  }

  return { avgLatencyMs, cacheHitRate, rawMetricsText: text };
};

const useGlobalMetrics = (refreshInterval: number | null = 30000): UseGlobalMetricsResult => {
  const [metrics, setMetrics] = useState<GlobalMetrics>({ 
    avgLatencyMs: null, 
    cacheHitRate: null,
    rawMetricsText: null 
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/metrics'); // Assumes next.config.js proxies /api/metrics
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
      }
      const textData = await response.text();
      const parsed = parsePrometheusMetrics(textData);
      setMetrics(parsed);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching metrics'));
      setMetrics({ avgLatencyMs: null, cacheHitRate: null, rawMetricsText: null }); // Reset on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(); // Fetch on initial mount
    if (refreshInterval) {
      const intervalId = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchMetrics, refreshInterval]);

  return { ...metrics, loading, error, fetchMetrics };
};

export default useGlobalMetrics; 