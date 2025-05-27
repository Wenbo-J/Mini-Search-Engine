#!/usr/bin/env python3
"""
Script: data_loader.py

Description:
    Reads the CSV corpus (dataset.csv) and writes a JSONL file
    with one document per line for bulk loading into Elasticsearch
    or for use by the Python search index.

Usage:
    cd backend/scripts
    python3 data_loader.py

Outputs:
    corpus.jsonl in the same directory
"""
import csv
import json
import os
import sys

# Increase CSV field size limit to accommodate very large fields
try:
    csv.field_size_limit(sys.maxsize)
except OverflowError:
    # For environments where sys.maxsize is too large
    max_int = sys.maxsize
    while True:
        try:
            csv.field_size_limit(max_int)
            break
        except OverflowError:
            max_int = int(max_int / 10)

# Adjust these paths if necessary
data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
csv_path = os.path.join(data_dir, 'dataset.csv')
jsonl_path = os.path.join(os.path.dirname(__file__), 'corpus.jsonl')

if not os.path.isfile(csv_path):
    print(f"ERROR: CSV file not found at {csv_path}")
    sys.exit(1)

print(f"Loading CSV from: {csv_path}")
print(f"Writing JSONL to: {jsonl_path}\n")

with open(csv_path, mode='r', encoding='utf-8', newline='') as csvfile, \
     open(jsonl_path, mode='w', encoding='utf-8') as jsonlfile:
    reader = csv.DictReader(csvfile)
    count = 0
    for row in reader:
        # Create document preserving original ID
        doc = {
            'id': row['document_id'],  # Map document_id to id
            'title': row.get('title', '').strip(),
            'content': row.get('content', '').strip(),
            'court': row.get('court', '').strip(),
            'date': row.get('date_posted', '').strip(),  # Map date_posted to date
        }
        # Write one JSON object per line
        jsonlfile.write(json.dumps(doc, ensure_ascii=False) + '\n')
        count += 1

print(f"Completed: {count} documents processed.")
