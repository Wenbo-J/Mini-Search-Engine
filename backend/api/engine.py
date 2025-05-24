import os
import json
import subprocess
from typing import List, Dict

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
        self.metadata_file = os.path.join(base_dir, 'search', 'metadata.tsv')  # adjust if needed

    def search(self, query: str, top_k: int = 10) -> List[Dict]:
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
        output = subprocess.check_output(cmd)
        return json.loads(output)