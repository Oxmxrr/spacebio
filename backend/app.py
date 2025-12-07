# app.py
import os, json
import warnings
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

import numpy as np

# --- Make FAISS optional so the app can boot in "light" mode on Render ---
try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None

from fastapi import FastAPI, UploadFile, File, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Authentication
from auth import (
    get_current_user, login as auth_login, LoginRequest, TokenResponse,
    is_auth_enabled
)

from rag_core import (
    get_client, CHAT_MODEL, EMBED_MODEL, embed_texts, build_prompt,
    ORGANISMS, STRESSORS, PLATFORMS
)

from speech_io import tts_piper_to_wav, stt_transcribe, gpu_status

# silence generic pkg_resources deprecation warnings
warnings.filterwarnings("ignore", message="pkg_resources is deprecated as an API", category=UserWarning)

# --------------------------------------------------------------------------------------
# Rate Limiter Setup
# --------------------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

# --------------------------------------------------------------------------------------
# Config & paths
# --------------------------------------------------------------------------------------
BOOT_MODE  = os.getenv("BOOT_MODE", "light").strip().lower()  # light | full
IDX_DIR    = "data/index"
META_PATH  = os.path.join(IDX_DIR, "meta.jsonl")
FAISS_PATH = os.path.join(IDX_DIR, "index.faiss")

os.makedirs(os.path.join("data", "audio"), exist_ok=True)

index = None  # type: ignore
meta: List[Dict[str, Any]] = []

# --------------------------------------------------------------------------------------
# Utilities
# --------------------------------------------------------------------------------------
def _parse_origins() -> List[str]:
    """
    ALLOWED_ORIGINS supports comma-separated URLs, e.g.:
    ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://example.com
    If empty, default to permissive for first deploy; tighten later.
    """
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    if not raw:
        # permissive default for first deploys; consider locking down later
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]

def _allow_origin_regex() -> Optional[str]:
    """
    If you want wildcard subdomains (e.g., Vercel previews), set:
    ALLOW_ORIGIN_REGEX=^https://.*\\.vercel\\.app$
    """
    rx = os.getenv("ALLOW_ORIGIN_REGEX", "").strip()
    return rx or None

def _load_index_and_meta():
    """Load FAISS index + metadata once at startup. Skips index in light mode or when FAISS absent."""
    global index, meta

    # Load meta always (cheap & useful for /library)
    meta.clear()
    if os.path.exists(META_PATH):
        with open(META_PATH, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    meta.append(json.loads(line))
                except Exception:
                    continue

    # Load FAISS only when requested and available
    if BOOT_MODE != "light" and faiss is not None and os.path.exists(FAISS_PATH):
        try:
            index = faiss.read_index(FAISS_PATH)
        except Exception:
            index = None
    else:
        index = None

    print(
        f"[startup] BOOT_MODE={BOOT_MODE} | faiss={'yes' if faiss else 'no'} | "
        f"index_loaded={'yes' if index is not None else 'no'} | meta_rows={len(meta)}"
    )

def _search_vectors(q_emb: np.ndarray, k: int):
    if index is None or faiss is None:
        raise RuntimeError("Vector index unavailable. Set BOOT_MODE=full and ensure FAISS/index files exist.")
    q = q_emb.astype("float32")
    faiss.normalize_L2(q)
    D, I = index.search(q, k)
    return D[0], I[0]

def _apply_filters(rows: List[Dict[str, Any]], organism, stressor, platform):
    def ok(r):
        if organism and r.get("organism") != organism:
            return False
        if stressor and r.get("stressor") != stressor:
            return False
        if platform and r.get("platform") != platform:
            return False
        return True
    return [r for r in rows if ok(r)]

def _majority(rows, key):
    vals = [r.get(key) for r in rows if r.get(key)]
    return Counter(vals).most_common(1)[0][0] if vals else None

def _guess_from_text(txt: str, vocab: dict):
    low = (txt or "").lower()
    best, score = None, 0
    for k, terms in vocab.items():
        s = sum(1 for t in terms if t in low)
        if s > score:
            best, score = k, s
    return best

def _normalize_voice_param(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = v.strip().lower()
    if s in ("", "string", "default", "none", "null"):
        return None
    return v.strip()

def _row_to_result(r: Dict[str, Any]) -> Dict[str, Any]:
    """Unified shape used by /search, /ask, and /library results."""
    text = r.get("text", "") or ""
    return {
        "title": r.get("doc_title") or "",
        "year": r.get("year"),
        "page": r.get("page_start"),
        "snippet": (text[:400] + "...") if len(text) > 400 else text,
        "path": r.get("doc_path") or "",
        "organism": r.get("organism"),
        "stressor": r.get("stressor"),
        "platform": r.get("platform"),
    }

def _pick_context(question: Optional[str], top_k: int, organism=None, stressor=None, platform=None, paths=None):
    """Select top-k rows then compress to short snippets."""
    rows = meta
    if paths:
        rows = [r for r in rows if r.get("doc_path") in set(paths)]
    elif question and index is not None and faiss is not None:
        q_vec = embed_texts([question])
        scores, ids = _search_vectors(q_vec, max(30, top_k * 4))
        rows = [meta[i] | {"score": float(scores[j])} for j, i in enumerate(ids)]
        # dedupe per (doc_path, page_start)
        seen, uniq = set(), []
        for r in rows:
            key = (r.get("doc_path"), r.get("page_start"))
            if key in seen:
                continue
            seen.add(key)
            uniq.append(r)
            if len(uniq) >= top_k:
                break
        rows = uniq

    rows = _apply_filters(rows, organism, stressor, platform)

    ctx = []
    for r in rows[:top_k]:
        snippet = (r.get("text") or "")[:800]
        ctx.append({
            "title": r.get("doc_title") or "",
            "year": r.get("year"),
            "page": r.get("page_start"),
            "path": r.get("doc_path") or "",
            "snippet": snippet
        })
    return ctx

# --------------------------------------------------------------------------------------
# FastAPI app + lifespan
# --------------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_index_and_meta()
    try:
        yield
    finally:
        pass

app = FastAPI(title="Space Biology Knowledge Engine (Backend)", lifespan=lifespan)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Static (exists because we created the directory above)
app.mount("/audio", StaticFiles(directory="data/audio"), name="audio")

# CORS (tighten by setting ALLOWED_ORIGINS / ALLOW_ORIGIN_REGEX in Render env)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(),
    allow_origin_regex=_allow_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------------------
class AskRequest(BaseModel):
    question: str
    top_k: int = 8
    organism: Optional[str] = None
    stressor: Optional[str] = None
    platform: Optional[str] = None

class AskSimpleRequest(BaseModel):
    question: str
    top_k: int = 8

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None

# MindMap + Story
class MindMapSource(BaseModel):
    title: str
    year: Optional[str] = None
    page: Optional[int] = None
    path: str
    snippet: str

class MindMapNode(BaseModel):
    id: str
    label: str
    kind: str  # 'organism' | 'stressor' | 'platform' | 'method' | 'gene' | 'concept'
    weight: float = 1.0

class MindMapEdge(BaseModel):
    source: str
    target: str
    relation: str
    weight: float = 1.0

class MindMapRequest(BaseModel):
    question: Optional[str] = None
    top_k: int = 20
    organism: Optional[str] = None
    stressor: Optional[str] = None
    platform: Optional[str] = None
    paths: Optional[List[str]] = None

class MindMapResponse(BaseModel):
    nodes: List[MindMapNode]
    edges: List[MindMapEdge]
    supportByNode: Dict[str, List[MindMapSource]]

class StoryRequest(BaseModel):
    question: Optional[str] = None
    mode: str = "scientific"   # 'scientific' | 'public' | 'chronological' | 'thematic'
    length: str = "short"      # 'short' | 'medium' | 'long'
    top_k: int = 15
    organism: Optional[str] = None
    stressor: Optional[str] = None
    platform: Optional[str] = None
    paths: Optional[List[str]] = None

class StoryOutlineItem(BaseModel):
    heading: str
    key_points: List[str]

class StoryResponse(BaseModel):
    markdown: str
    outline: List[StoryOutlineItem]
    sources: List[MindMapSource]

# --------------------------------------------------------------------------------------
# System / Status (Public endpoints - no auth required)
# --------------------------------------------------------------------------------------
@app.get("/")
def root():
    return {
        "name": "Space Biology Knowledge Engine (Backend)",
        "mode": BOOT_MODE,
        "faiss": bool(faiss),
        "index_loaded": bool(index),
        "vectors": int(index.ntotal) if index is not None else 0,
        "auth_required": is_auth_enabled()
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/auth/status")
def auth_status():
    """Check if authentication is required."""
    from auth import APP_PASSWORD
    return {
        "auth_required": is_auth_enabled(),
        "password_configured": len(APP_PASSWORD) > 0
    }

@app.post("/auth/login", response_model=TokenResponse)
@limiter.limit("5/minute")  # Rate limit login attempts to prevent brute force
def login(request: Request, body: LoginRequest):
    """Login with password to get a JWT token."""
    return auth_login(body.password)

@app.get("/auth/verify")
def verify_token(user: dict = Depends(get_current_user)):
    """Verify if the current token is valid."""
    return {"valid": True, "user": user}

# --------------------------------------------------------------------------------------
# Protected Status Endpoints (require auth)
# --------------------------------------------------------------------------------------
@app.get("/ping")
def ping(user: dict = Depends(get_current_user)):
    return {"status": "ok", "index_loaded": bool(index), "vectors": index.ntotal if index else 0}

@app.get("/gpu")
def gpu(user: dict = Depends(get_current_user)):
    status = gpu_status()
    status["faiss_gpu"] = False  # faiss-cpu (or no faiss) on cloud free tiers
    return status

@app.get("/stats")
def stats(user: dict = Depends(get_current_user)):
    org = Counter([r.get("organism") for r in meta if r.get("organism")])
    strsr = Counter([r.get("stressor") for r in meta if r.get("stressor")])
    plat = Counter([r.get("platform") for r in meta if r.get("platform")])
    return {
        "organisms": org.most_common(),
        "stressors": strsr.most_common(),
        "platforms": plat.most_common(),
        "chunks": len(meta)
    }

# --------------------------------------------------------------------------------------
# Library (direct meta.jsonl) - Protected
# --------------------------------------------------------------------------------------
@app.get("/library")
def library(
    q: Optional[str] = Query(None, description="Full-text match on title/text/path"),
    organism: Optional[str] = Query(None),
    stressor: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    sort: Optional[str] = Query(None, description="Sort by 'year' or 'path'"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    user: dict = Depends(get_current_user),
):
    rows = meta

    if organism or stressor or platform:
        rows = _apply_filters(rows, organism, stressor, platform)

    if q:
        needle = q.lower().strip()
        def hit(r: Dict[str, Any]) -> bool:
            return (
                needle in (r.get("doc_title") or "").lower()
                or needle in (r.get("text") or "").lower()
                or needle in (r.get("doc_path") or "").lower()
            )
        rows = [r for r in rows if hit(r)]

    if sort in ("year", "path"):
        reverse = (order == "desc")
        if sort == "year":
            def yr(v) -> Tuple[int, str]:
                y = v.get("year")
                try:
                    return (int(y), "") if y is not None else (-10**9, "")
                except Exception:
                    return (-10**9, str(y or ""))
            rows = sorted(rows, key=yr, reverse=reverse)
        else:
            rows = sorted(rows, key=lambda r: r.get("doc_path") or "", reverse=reverse)

    total = len(rows)
    start = (page - 1) * page_size
    end = start + page_size
    page_rows = rows[start:end]
    results = [_row_to_result(r) for r in page_rows]

    # Dedupe to 1 row per (doc_path) keeping first occurrence
    seen_paths = set()
    unique_results = []
    for r in results:
        if r["path"] in seen_paths:
            continue
        seen_paths.add(r["path"])
        unique_results.append(r)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": unique_results
    }

# --------------------------------------------------------------------------------------
# Semantic search / Ask - Protected with rate limiting
# --------------------------------------------------------------------------------------
@app.get("/search")
@limiter.limit("30/minute")  # Limit searches
def search(request: Request, q: str, top_k: int = 10, user: dict = Depends(get_current_user)):
    if index is None or faiss is None:
        return JSONResponse({"error": "Index missing. Set BOOT_MODE=full and run ingest to build FAISS."}, status_code=400)
    em = embed_texts([q])
    scores, ids = _search_vectors(em, top_k)
    out = []
    seen = set()
    for j, i in enumerate(ids):
        r = meta[i]
        item = _row_to_result(r)
        item["score"] = float(scores[j])
        # dedupe per (doc_path,page) at the API level
        key = (item["path"], item["page"])
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return {"results": out}

@app.post("/ask")
@limiter.limit("20/minute")  # Limit expensive LLM calls
def ask(request: Request, req: AskRequest, user: dict = Depends(get_current_user)):
    if index is None or faiss is None:
        return JSONResponse({"error": "Index missing. Set BOOT_MODE=full and run ingest to build FAISS."}, status_code=400)

    q_vec = embed_texts([req.question])
    scores, ids = _search_vectors(q_vec, max(30, req.top_k * 4))
    rows = [meta[i] | {"score": float(scores[j])} for j, i in enumerate(ids)]
    rows = _apply_filters(rows, req.organism, req.stressor, req.platform)

    selected, seen = [], set()
    for r in rows:
        key = (r["doc_path"], r["page_start"])
        if key in seen:
            continue
        seen.add(key)
        selected.append(r)
        if len(selected) >= req.top_k:
            break

    client = get_client()
    messages = build_prompt(req.question, selected)
    chat = client.chat.completions.create(model=CHAT_MODEL, temperature=0.2, messages=messages)
    answer = chat.choices[0].message.content

    sources = [{
        "title": r["doc_title"],
        "year": r.get("year"),
        "page": r.get("page_start"),
        "path": r["doc_path"],
        "organism": r.get("organism"),
        "stressor": r.get("stressor"),
        "platform": r.get("platform"),
        "score": r["score"]
    } for r in selected]

    return {"answer": answer, "sources": sources}

@app.post("/ask-simple")
@limiter.limit("20/minute")  # Limit expensive LLM calls
def ask_simple(request: Request, req: AskSimpleRequest, tts: bool = False, user: dict = Depends(get_current_user)):
    if index is None or faiss is None:
        return JSONResponse({"error": "Index missing. Set BOOT_MODE=full and run ingest to build FAISS."}, status_code=400)

    q_vec = embed_texts([req.question])
    scores, ids = _search_vectors(q_vec, max(30, req.top_k * 4))
    rows = [meta[i] | {"score": float(scores[j])} for j, i in enumerate(ids)]

    q_guess = {
        "organism": _guess_from_text(req.question, ORGANISMS),
        "stressor": _guess_from_text(req.question, STRESSORS),
        "platform": _guess_from_text(req.question, PLATFORMS)
    }
    def bonus(r):
        b = 0.0
        if q_guess["organism"] and r.get("organism")==q_guess["organism"]: b += 0.05
        if q_guess["stressor"] and r.get("stressor")==q_guess["stressor"]: b += 0.05
        if q_guess["platform"] and r.get("platform")==q_guess["platform"]: b += 0.05
        return b
    rows.sort(key=lambda r: r["score"] + bonus(r), reverse=True)

    selected, seen = [], set()
    for r in rows:
        key = (r["doc_path"], r["page_start"])
        if key in seen:
            continue
        seen.add(key)
        selected.append(r)
        if len(selected) >= req.top_k:
            break

    inferred = {
        "organism": _majority(selected, "organism"),
        "stressor": _majority(selected, "stressor"),
        "platform": _majority(selected, "platform")
    }

    client = get_client()
    messages = build_prompt(req.question, selected)
    chat = client.chat.completions.create(model=CHAT_MODEL, temperature=0.2, messages=messages)
    answer = chat.choices[0].message.content

    sources = [{
        "title": r["doc_title"],
        "year": r.get("year"),
        "page": r.get("page_start"),
        "path": r["doc_path"],
        "organism": r.get("organism"),
        "stressor": r.get("stressor"),
        "platform": r.get("platform"),
        "score": r["score"]
    } for r in selected]

    payload = {
        "answer": answer,
        "sources": sources,
        "inferred_facets": inferred,
        "query_guess": q_guess
    }

    if tts:
        _, url_path = tts_piper_to_wav(answer)
        payload["tts_audio_url"] = url_path

    return payload

# --------------------------------------------------------------------------------------
# MindMap builder
# --------------------------------------------------------------------------------------
MINDMAP_SYS = (
    "You extract a compact concept graph from provided research snippets. "
    "Return STRICT JSON with keys: nodes, edges. "
    "Nodes: [{id, label, kind, weight}]; Edges: [{source, target, relation, weight}]. "
    "Kinds must be one of: organism, stressor, platform, method, gene, concept. "
    "Use short, canonical ids (lowercase, dashes)."
)

def _mindmap_prompt(question: Optional[str], ctx: List[Dict[str,Any]]) -> str:
    header = f"QUESTION: {question or 'N/A'}\n\n"
    body = "CONTEXT SNIPPETS (title | year | page | path | snippet):\n"
    for c in ctx:
        line = f"- {c['title']} | {c.get('year')} | p{c.get('page')} | {c['path']}\n{c['snippet']}\n"
        body += line + "\n"
    tail = (
        "Rules:\n"
        "- Merge duplicates across snippets.\n"
        "- Prefer relations like 'affects', 'measured_in', 'associated_with', 'expressed_in', 'occurs_on'.\n"
        "- Weight in [0.5..2.0] for salience.\n"
        "Output JSON ONLY, no prose."
    )
    return header + body + tail

@app.post("/mindmap", response_model=MindMapResponse)
@limiter.limit("10/minute")  # Limit expensive LLM calls
def build_mindmap(request: Request, req: MindMapRequest, user: dict = Depends(get_current_user)):
    ctx = _pick_context(req.question, req.top_k, req.organism, req.stressor, req.platform, req.paths)
    client = get_client()
    messages = [
        {"role":"system", "content": MINDMAP_SYS},
        {"role":"user", "content": _mindmap_prompt(req.question, ctx)}
    ]
    chat = client.chat.completions.create(
        model=CHAT_MODEL,
        temperature=0.2,
        messages=messages,
        response_format={"type": "json_object"}
    )
    raw = chat.choices[0].message.content
    try:
        data = json.loads(raw)
    except Exception:
        # Minimal fallback
        data = {"nodes": [], "edges": []}

    # Build supportByNode (simple heuristic: attach all sources to all nodes)
    support: Dict[str, List[Dict[str, Any]]] = {}
    for c in ctx:
        src = MindMapSource(**c)
        for n in data.get("nodes", []):
            support.setdefault(n["id"], []).append(src.model_dump())

    return {
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
        "supportByNode": support
    }

# --------------------------------------------------------------------------------------
# Story builder
# --------------------------------------------------------------------------------------
def _story_sys(mode: str):
    base = (
      "You write a cohesive narrative from research snippets with headings and clear flow. "
      "Produce two outputs: 1) MARKDOWN story with H2/H3 headings; "
      "2) OUTLINE as JSON array [{heading, key_points:[...]}]. "
      "Be accurate and cite inline with [#] that map to Sources."
    )
    if mode == "scientific":
        style = "Use sections: Background, Question, Methods, Findings, Limitations, Next steps."
    elif mode == "public":
        style = "Write in plain language, add a short 'Why it matters'."
    elif mode == "chronological":
        style = "Organize by time: earliest to latest."
    else:
        style = "Group by themes (stressor/platform/organism)."
    return base + " " + style

def _story_prompt(question: Optional[str], ctx: List[Dict[str,Any]], length: str) -> str:
    length_hint = {"short":"~500 words","medium":"~900 words","long":"~1300 words"}[length]
    header = f"QUESTION: {question or 'N/A'}\nTARGET LENGTH: {length_hint}\n\n"
    body = "SOURCES (index with #):\n"
    for i, c in enumerate(ctx, 1):
        body += f"[{i}] {c['title']} ({c.get('year')}) p{c.get('page')} — {c['path']}\n"
    body += "\nRESEARCH EXCERPTS:\n"
    for i, c in enumerate(ctx, 1):
        body += f"[{i}] {c['snippet']}\n\n"
    tail = (
        "Return STRICT JSON with keys: markdown, outline. "
        "The markdown must use the [#] indices for inline citations. No extra keys."
    )
    return header + body + tail

def _story_from_context(req: StoryRequest) -> StoryResponse:
    ctx = _pick_context(req.question, req.top_k, req.organism, req.stressor, req.platform, req.paths)
    client = get_client()
    messages = [
        {"role":"system", "content": _story_sys(req.mode)},
        {"role":"user", "content": _story_prompt(req.question, ctx, req.length)}
    ]
    chat = client.chat.completions.create(
        model=CHAT_MODEL,
        temperature=0.3,
        messages=messages,
        response_format={"type": "json_object"}
    )
    try:
        data = json.loads(chat.choices[0].message.content)
    except Exception:
        data = {"markdown": "", "outline": []}

    return StoryResponse(
        markdown=data.get("markdown", ""),
        outline=[StoryOutlineItem(**it) for it in data.get("outline", [])] if isinstance(data.get("outline", []), list) else [],
        sources=[MindMapSource(**c) for c in ctx]
    )

@app.post("/story", response_model=StoryResponse)
@limiter.limit("10/minute")  # Limit expensive LLM calls
def build_story(request: Request, req: StoryRequest, user: dict = Depends(get_current_user)):
    return _story_from_context(req)

# Alias for compatibility with frontend that calls /storytelling
@app.post("/storytelling", response_model=StoryResponse)
@limiter.limit("10/minute")
def storytelling_alias(request: Request, req: StoryRequest, user: dict = Depends(get_current_user)):
    return _story_from_context(req)

# --------------------------------------------------------------------------------------
# Speech I/O - Protected
# --------------------------------------------------------------------------------------
@app.get("/tts/voices")
def list_voices(user: dict = Depends(get_current_user)):
    voices = []
    base = os.path.join("models", "piper")
    if os.path.isdir(base):
        for f in os.listdir(base):
            if f.endswith(".onnx"):
                voices.append(f)
    return {"voices": voices}

@app.post("/tts")
@limiter.limit("30/minute")
def tts(request: Request, req: TTSRequest, user: dict = Depends(get_current_user)):
    text = (req.text or "").strip()
    if not text:
        return JSONResponse({"error": "text is empty"}, status_code=400)
    voice = _normalize_voice_param(req.voice)
    wav_path, url_path = tts_piper_to_wav(text, voice_name=voice)
    return {"audio_url": url_path, "file_path": wav_path}

@app.post("/stt")
@limiter.limit("20/minute")
def stt(request: Request, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    os.makedirs("data/tmp", exist_ok=True)
    temp_path = os.path.join("data", "tmp", file.filename)
    with open(temp_path, "wb") as f:
        f.write(file.file.read())
    text = stt_transcribe(temp_path)
    return {"text": text}
