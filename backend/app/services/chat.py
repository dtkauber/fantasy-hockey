"""
Draft assistant: a chat-style advisor that answers questions about who to
draft, grounded in the actual VORP/VONA numbers already computed on the
frontend (see DraftHelper.tsx) rather than letting the model invent stats.

Uses the OpenAI Chat Completions API with streaming, since this feeds a chat UI.
"""
import json
import os

from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MODEL = "gpt-4o"

SYSTEM_PROMPT = """You are a fantasy hockey draft assistant. A user is running a mock \
draft and will ask you things like "who should I draft next", "should I take a \
goalie now or wait", or "who's the best value at defense right now".

Every message includes a <draft_context> block (JSON) with the live state of the \
mock draft:
- league: draft format (either "split" -- separate C/LW/RW/D/G roster slots -- or \
"flex" -- forwards share one combined F slot), number of teams, and how many \
starters per position each team rosters. This determines position scarcity.
- drafted: players already taken in this mock draft (name, position, team).
- available: the best remaining undrafted players, already ranked by VORP \
(descending), each with:
  - vorp: fantasy points above a replacement-level player at their position in a \
league this size -- the primary "best pick accounting for scarcity" signal.
  - vona: fantasy points above the very next available player at the same \
position -- how much value is lost if this position is skipped this round.
  - total_points / points_per_game: season-to-date fantasy points under the \
league's default scoring.
  - games_played: how many games of data these numbers are based on.

Ground every recommendation in this data -- name specific players from the \
available list, and cite their vorp/vona/points when it supports your answer. \
Never invent stats or suggest a player not present in the context. If the \
available list doesn't contain enough information to answer confidently, say so.

Keep answers tight: a few sentences for a straightforward question, a short \
paragraph at most for something that genuinely needs comparison across several \
players. This is a live draft -- the user needs an answer fast, not an essay."""


def _build_user_content(context: dict, question: str) -> str:
    return f"<draft_context>\n{json.dumps(context)}\n</draft_context>\n\n{question}"


async def stream_draft_advice(history: list[dict], context: dict, question: str):
    """Yields response text chunks as they arrive from the model."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history,
        {"role": "user", "content": _build_user_content(context, question)},
    ]

    stream = await client.chat.completions.create(
        model=MODEL,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
