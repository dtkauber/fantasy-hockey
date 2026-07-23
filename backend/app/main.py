from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import players, draft, sync, leagues

app = FastAPI(title="Fantasy Hockey Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router)
app.include_router(draft.router)
app.include_router(sync.router)
app.include_router(leagues.router)


@app.get("/health")
def health():
    return {"status": "ok"}
