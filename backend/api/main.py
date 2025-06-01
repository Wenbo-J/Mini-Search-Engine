from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
from .engine import PythonSearchEngine
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST


class SearchRequest(BaseModel):
    query: str
    page: int = 1
    limit: int = 10

class SearchResult(BaseModel):
    id: str
    title: str
    snippet: str
    score: float
    court: str
    date: str

class SearchResponse(BaseModel):
    results: list[SearchResult]
    total_in_window: int

app = FastAPI(title="Search Engine API")

# Mount Prometheus metrics at /metrics
@app.get("/metrics")
def metrics():
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)

# Initialize the search engine (Python-based)
engine = PythonSearchEngine()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/search", response_model=SearchResponse)
def search_endpoint(req: SearchRequest):
    try:
        engine_response = engine.search(req.query, req.page, req.limit)
        return {
            "results": engine_response["page_results"],
            "total_in_window": engine_response["total_in_window"]
        }
    except Exception as e:
        print(f"Error during search: {e}")
        raise HTTPException(status_code=500, detail=str(e))
