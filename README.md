# Quick Legal Retriever

Quick Legal Retriever is a mini search engine designed to search through a corpus of legal documents. It features a Python-based backend using FastAPI for the API and search logic, and a React/Next.js frontend for the user interface.

## Features

- **Backend (Python/FastAPI):**
  - Search functionality over a document corpus.
  - Caching of search results using Redis.
  - Exposes Prometheus-compatible metrics for monitoring (e.g., cache hits/misses, request latency).
  - API endpoints for search (`/search`), health checks (`/health`), and metrics (`/metrics`).
- **Frontend (React/Next.js):**
  - User-friendly interface to enter search queries.
  - Paginated display of search results (title, snippet, court, date, score).
  - Clickable search result cards (stubbed for navigation to full document view).
  - Real-time global metrics dashboard (Average Request Latency, Cache Hit Rate) fetched from the backend's `/metrics` endpoint.
  - Loading indicators and error handling.
- **Search Logic (Conceptual - `search.py`):
  - (Assumed) Uses dictionary and postings files for inverted index search.
  - (Assumed) Retrieves document metadata from a corpus file.

## Tech Stack

- **Backend:**
  - Python 3
  - FastAPI (for API development)
  - Redis (for caching)
  - `prometheus-client` (for exposing metrics)
  - `uvicorn` (ASGI server)
- **Frontend:**
  - Node.js & npm/yarn
  - React
  - Next.js (React framework)
  - TypeScript
- **Search Script (`search/search.py` - external to this direct implementation but utilized):
  - Python 3

## Prerequisites

- Python 3.8+
- Node.js 16.x+ and npm/yarn
- Redis server running (default: `localhost:6379`)
- The `search/search.py` script and its dependencies (`dictionary.txt`, `postings.txt`, `scripts/corpus.jsonl`) correctly placed relative to the `backend/api` directory as expected by `backend/api/engine.py`.

## Project Structure

```
mini-search-engine/
├── backend/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── engine.py     # Search engine logic, caching, metrics calculation
│   │   └── main.py       # FastAPI application, API endpoints
│   ├── search/         # (Assumed) Contains search.py, dictionary.txt, postings.txt
│   │   └── search.py
│   │   └── dictionary.txt
│   │   └── postings.txt
│   └── scripts/
│       └── corpus.jsonl  # (Assumed) Document metadata
├── frontend/
│   ├── components/
│   │   ├── MetricsDashboard.tsx
│   │   └── SearchResultCard.tsx
│   ├── hooks/
│   │   ├── useGlobalMetrics.tsx
│   │   └── useSearch.tsx
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── api/          # Next.js API routes (not used for main backend here, but for proxying)
│   │   └── index.tsx     # Main search page
│   ├── public/
│   ├── styles/
│   ├── next.config.js  # Next.js configuration (for proxying API requests)
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Setup and Installation

**1. Backend Setup**

Navigate to the backend directory:
```bash
cd backend/api 
# Or wherever your main.py and engine.py are located
```

Create a virtual environment and install Python dependencies:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt # You'll need to create a requirements.txt
```

A `requirements.txt` for the backend would typically include:
```txt
fastapi
uvicorn[standard]
redis
prometheus-client
# Add any other specific dependencies your search.py might have if run in the same env,
# or ensure they are available to the python3 interpreter that runs search.py
```

**2. Frontend Setup**

Navigate to the frontend directory:
```bash
cd frontend
```

Install Node.js dependencies:
```bash
npm install
# or
yarn install
```

## Running the Application

**1. Start Redis Server**

Ensure your Redis server is running. If installed locally, it often starts automatically. If not, start it (e.g., `redis-server`).

**2. Start the Backend Server**

From the `backend/api` directory (or wherever `main.py` is located), with your virtual environment activated:
```bash
uvicorn main:app --reload --port 8000
```
The backend API will typically be available at `http://localhost:8000`.

**3. Start the Frontend Development Server**

From the `frontend` directory:
```bash
npm run dev
# or
yarn dev
```
The frontend application will typically be available at `http://localhost:3000`.

**Proxy Configuration:**
The frontend `next.config.js` is set up to proxy requests from `/api/*` to the backend server running on `http://localhost:8000/*`. This allows the frontend to make API calls to `/api/search` and `/api/metrics` as if they were part of the frontend's domain, avoiding CORS issues during development.

## API Endpoints (Backend - `http://localhost:8000`)

- `POST /search`: 
  - Accepts a JSON body: `{ "query": "string", "page": int (optional, default 1), "limit": int (optional, default 10) }`
  - Returns search results for the current page and total results within the pagination window.
- `GET /health`: Returns the health status of the API (`{ "status": "ok" }`).
- `GET /metrics`: Exposes Prometheus-compatible metrics.

## Notes

- **Search Script (`search.py`):** The backend's `engine.py` calls an external `search.py` script via `subprocess`. Ensure this script is executable, its dependencies are met, and the paths in `engine.py` to the script, dictionary, postings, and metadata files are correct for your environment.
- **Metrics Dashboard:** The frontend displays global metrics (average latency, cache hit rate) by fetching and parsing data from the `/api/metrics` endpoint. Average latency is calculated from the sum and count of the `search_request_latency_seconds` histogram. True P95 latency calculation would typically require a Prometheus server querying this endpoint.
- **Clickable Results:** Search result cards are designed to be clickable, linking to a placeholder `/doc/[id]` route. To make this functional, a backend endpoint to fetch full document content by ID and a corresponding Next.js page would need to be implemented.
- **Caching:** Search results (for a window of documents) are cached in Redis by the backend to improve performance on repeated queries for the same data window.


This README provides a general guide. Specific paths and configurations might need adjustments based on your exact project layout and environment.