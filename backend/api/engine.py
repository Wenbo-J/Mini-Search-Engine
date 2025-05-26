import redis
import hashlib
import os
import json
import subprocess
from typing import List, Dict # just in case

class SearchEngine:
    def search(self, query: str, top_k: int = 10) -> List[Dict]:
        """
        Abstract search interface. Returns a list of result dicts.
        """
        raise NotImplementedError

class PythonSearchEngine(SearchEngine):
    def __init__(self):
        # Base directory (backend/api)
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        self.search_script = os.path.join(base_dir, 'search', 'search.py')
        self.dict_file = os.path.join(base_dir, 'search', 'dictionary.txt')
        self.postings_file = os.path.join(base_dir, 'search', 'postings.txt')
        self.metadata_file = os.path.join(base_dir, 'search', '../scripts/corpus.jsonl')  # adjust if needed
        self.redis = redis.Redis(host='localhost', port=6379, db=0)
        self.cache_ttl = 3600  # 1 hour

    def _cache_key(self, query: str, top_k: int) -> str:
        # Use a hash to ensure key length stays reasonable
        h = hashlib.sha256(f"{query}|{top_k}".encode()).hexdigest()
        return f"search:{h}"

    def search(self, query: str, top_k: int = 10) -> List[Dict]:
        key = self._cache_key(query, top_k)
        # 1) Try cache
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        
        # 2) Cache miss: run subprocess :(
        # Construct the CLI command with all required flags
        cmd = [
            "python3", self.search_script,
            "--dict-file", self.dict_file,
            "--postings-file", self.postings_file,
            "--metadata-file", self.metadata_file,
            "--query", query,
            "--topk", str(top_k),
            "--output-format", "json"
        ]
        # Execute the search script and parse JSON output
        output = subprocess.check_output(cmd, text=True)
        results = json.loads(output)    

        # 3) Store in cache
        self.redis.set(key, json.dumps(results), ex=self.cache_ttl)
        return results