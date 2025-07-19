import redis
import hashlib
import os
import json
import subprocess
from typing import List, Dict # Tuple removed as _get_metrics is removed
from prometheus_client import Counter, Histogram

# define prometheus metrics
CACHE_HITS = Counter(
    "search_cache_hits_total", "Total number of cache hits"
)
CACHE_MISSES = Counter(
    "search_cache_misses_total", "Total number of cache misses"
)
# Note: For true p95 latency, a Prometheus server should scrape /metrics and calculate it.
REQUEST_LATENCY = Histogram(
    "search_request_latency_seconds", "Latency of search requests"
)

PAGINATION_RESULT_WINDOW = 100

class SearchEngine:
    def search(self, query: str, page: int = 1, limit: int = 10) -> Dict:
        """
        Abstract search interface.
        Returns a dict with 'page_results' and 'total_in_window'.
        Metrics (avg_latency_ms, cache_hit_rate) are removed from this response.
        They should be fetched from the /metrics endpoint.
        """
        raise NotImplementedError

class PythonSearchEngine(SearchEngine):
    def __init__(self):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        self.search_script = os.path.join(base_dir, 'search', 'search.py')
        self.dict_file = os.path.join(base_dir, 'search', 'dictionary.txt')
        self.postings_file = os.path.join(base_dir, 'search', 'postings.txt')
        self.metadata_file = os.path.join(base_dir, 'scripts', 'corpus.jsonl')  # adjust if needed
        self.redis = redis.Redis(host='localhost', port=6379, db=0)
        self.cache_ttl = 3600  # 1 hour
        self._dictionary_terms = self._load_dictionary_terms()

    def _cache_key(self, query: str) -> str: # Cache key will be for the whole window
        # Use a hash to ensure key length stays reasonable
        h = hashlib.sha256(f"{query}|{PAGINATION_RESULT_WINDOW}".encode()).hexdigest()
        return f"search_window:{h}"

    def _load_dictionary_terms(self) -> List[str]:
        # Load all terms from dictionary.txt, strip whitespace, ignore empty lines
        if not os.path.exists(self.dict_file):
            print(f"Dictionary file not found: {self.dict_file}")
            return []
        with open(self.dict_file, 'r', encoding='utf-8') as f:
            terms = [line.strip() for line in f if line.strip()]
        return terms

    def get_suggestions(self, prefix: str, limit: int = 5) -> List[str]:
        # Case-insensitive prefix matching, return up to 'limit' suggestions
        prefix_lower = prefix.lower()
        suggestions = [term for term in self._dictionary_terms if term.lower().startswith(prefix_lower)]
        return suggestions[:limit]

    @REQUEST_LATENCY.time() # This will still record latency for the current request
    def search(self, query: str, page: int = 1, limit: int = 10) -> Dict:
        key = self._cache_key(query) # Cache based on query for the PAGINATION_RESULT_WINDOW
        
        all_results_in_window: List[Dict] = []

        # 1) Try cache for the entire window
        cached_window = self.redis.get(key)
        if cached_window:
            CACHE_HITS.inc()
            all_results_in_window = json.loads(cached_window)
        else:
            CACHE_MISSES.inc()
            # 2) Cache miss: run subprocess to get the window
            cmd = [
                "python3", self.search_script,
                "--dict-file", self.dict_file,
                "--postings-file", self.postings_file,
                "--metadata-file", self.metadata_file,
                "--query", query,
                "--topk", str(PAGINATION_RESULT_WINDOW), # Fetch the whole window
                "--output-format", "json"
            ]
            try:
                output = subprocess.check_output(cmd, text=True)
                all_results_in_window = json.loads(output)
                # 3) Store the entire window in cache
                self.redis.set(key, json.dumps(all_results_in_window), ex=self.cache_ttl)
            except subprocess.CalledProcessError as e:
                # Handle errors from the script, e.g., if it returns non-zero exit code
                print(f"Search script error: {e}")
                all_results_in_window = [] # Return empty if script fails
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON from search script: {e}")
                all_results_in_window = []

        total_in_window = len(all_results_in_window)

        # Perform pagination on the retrieved window
        start_index = (page - 1) * limit
        end_index = start_index + limit
        page_results = all_results_in_window[start_index:end_index]
        
        # Metrics are no longer calculated and returned here
        return {
            "page_results": page_results,
            "total_in_window": total_in_window
            # avg_latency_ms and cache_hit_rate removed
        }