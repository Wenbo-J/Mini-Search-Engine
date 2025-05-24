from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from api.engine import PythonSearchEngine

class SearchRequest(BaseModel):
    query: str
    top_k: int = 10

class SearchResult(BaseModel):
    id: str
    title: str
    snippet: str
    score: float
    court: str
    date: str

class SearchResponse(BaseModel):
    results: list[SearchResult]

app = FastAPI(title="Search Engine API")

# Initialize the search engine (Python-based)
engine = PythonSearchEngine()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/search", response_model=SearchResponse)
def search_endpoint(req: SearchRequest):
    try:
        raw_results = engine.search(req.query, req.top_k)
        # raw_results should be a list of dicts matching SearchResult fields
        return {"results": raw_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
