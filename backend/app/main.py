import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .limiter import limiter
from .routers import players, draft, sync, leagues, teams, chat

load_dotenv()

app = FastAPI(title="Fantasy Hockey Manager API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Local dev origins are always allowed; add the deployed frontend's origin via
# env var so this doesn't need a code change (or a hardcoded guess) per deploy.
_extra_origin = os.getenv("FRONTEND_ORIGIN")
_allowed_origins = ["http://localhost:5173", "http://localhost:3000"]
if _extra_origin:
    _allowed_origins.append(_extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router)
app.include_router(draft.router)
app.include_router(sync.router)
app.include_router(leagues.router)
app.include_router(teams.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
