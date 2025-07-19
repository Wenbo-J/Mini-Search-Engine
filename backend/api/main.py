from fastapi import FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from .engine import PythonSearchEngine
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
import json


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

@app.websocket("/ws/suggestions")
async def websocket_suggestions(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                prefix = msg.get("prefix", "")
                suggestions = engine.get_suggestions(prefix, limit=5) # Limit to 5 suggestions, can be changed
                await websocket.send_text(json.dumps({"suggestions": suggestions}))
            except Exception as e:
                await websocket.send_text(json.dumps({"error": str(e)}))
    except WebSocketDisconnect:
        pass
