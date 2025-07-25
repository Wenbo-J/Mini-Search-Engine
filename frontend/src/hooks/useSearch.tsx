import { useState, useCallback } from 'react';

// Define an interface for the search result item
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  court: string;
  date: string;
  score: number;
}

// Define an interface for the API response
interface BackendSearchResponse {
  results: SearchResult[];
  total_in_window: number; // Renamed from total, matches backend
  // avg_latency_ms and cache_hit_rate are removed as they are now fetched via /api/metrics
}

// Define an interface for the hook's return value
interface UseSearchResult {
  results: SearchResult[];
  totalResults: number; // This will be total_in_window from backend
  loading: boolean;
  error: Error | null;
  search: (query: string, page?: number, limit?: number) => Promise<void>;
}

const useSearch = (): UseSearchResult => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0); // Re-added for pagination
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (query: string, page: number = 1, limit: number = 10) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send page and limit in the body as per updated backend
        body: JSON.stringify({ query, page, limit }), // top_k removed, using page & limit
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data: BackendSearchResponse = await response.json();
      setResults(data.results);
      setTotalResults(data.total_in_window); // Set totalResults from backend response

    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      setResults([]);
      setTotalResults(0); // Reset on error
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, totalResults, loading, error, search }; // avgLatencyMs and cacheHitRate removed from return
};

export default useSearch;
