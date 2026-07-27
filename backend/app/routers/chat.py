import json
import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..limiter import limiter
from ..services.chat import stream_draft_advice

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    history: list[ChatMessage] = []
    context: dict
    question: str


@router.post("/draft-advice")
@limiter.limit("10/minute")
async def draft_advice(request: Request, payload: ChatRequest):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(500, "OPENAI_API_KEY is not configured on the server.")

    async def event_stream():
        try:
            async for chunk in stream_draft_advice(
                [m.model_dump() for m in payload.history],
                payload.context,
                payload.question,
            ):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
