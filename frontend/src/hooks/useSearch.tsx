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
  // Backend does not return total, p95Latency, or cacheHitRate in this response
}

// Define an interface for the hook's return value
interface UseSearchResult {
  results: SearchResult[];
  loading: boolean;
  error: Error | null;
  // totalResults, p95Latency, cacheHitRate are removed as backend doesn't provide them for /search
  search: (query: string, limit?: number) => Promise<void>;
}

const useSearch = (): UseSearchResult => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  // totalResults, p95Latency, cacheHitRate states are removed

  const search = useCallback(async (query: string, limit: number = 10) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/search', { // Path might need adjustment if /api prefix is handled by Next.js proxy
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, top_k: limit }),
      });

      if (!response.ok) {
        const errorData = await response.text(); // Try to get more error info
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data: BackendSearchResponse = await response.json();
      setResults(data.results);
      // setTotalResults, setP95Latency, setCacheHitRate are removed

    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Return value updated
  return { results, loading, error, search };
};

export default useSearch;
