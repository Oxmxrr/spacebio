# rag_core.py
import os, re, json, math
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import fitz  # PyMuPDF
import tiktoken
from dotenv import load_dotenv
from openai import OpenAI
# Load .env as early as possible (so OPENAI_API_KEY is present)
load_dotenv()

# ---- Config (env overrides allowed) ----
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")
CHAT_MODEL  = os.getenv("CHAT_MODEL",  "gpt-4o-mini")
CHUNK_TOKENS  = 900
CHUNK_OVERLAP = 200

# Lazy client: don't create at import time unless key exists
_client: Optional[OpenAI] = None
def get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set. Put it in .env or set the env var before running.")
        _client = OpenAI(api_key=api_key)
    return _client

_enc = tiktoken.get_encoding("cl100k_base")

# --- Facet vocab ---
ORGANISMS: Dict[str, List[str]] = {
    "rodent": ["mouse","mice","rat","rats","murine","rodent"],
    "drosophila": ["drosophila","fruit fly","fruit flies"],
    "arabidopsis": ["arabidopsis","a. thaliana","thaliana"],
    "human": ["human","astronaut","crew member","crew"],
    "yeast": ["yeast","s. cerevisiae","cerevisiae"],
    "zebrafish": ["zebrafish","danio rerio"]
}
STRESSORS: Dict[str, List[str]] = {
    "microgravity": ["microgravity","spaceflight","space flight","0 g","μg","weightlessness"],
    "radiation": ["radiation","cosmic ray","galactic cosmic","GCR","ionizing"],
    "launch/landing": ["launch","landing","re-entry","reentry","ascent","descent"],
    "isolation": ["isolation","confinement"],
    "partial-g": ["lunar gravity","martian gravity","1/6 g","3/8 g","partial gravity"]
}
PLATFORMS: Dict[str, List[str]] = {
    "ISS": ["iss","international space station"],
    "Shuttle": ["space shuttle","sts-"],
    "Ground Analog": ["hindlimb unloading","bed rest","clinostat","random positioning machine","rpm"]
}

# ----------------- Core utils -----------------
def tokenize_len(text: str) -> int:
    return len(_enc.encode(text))

def chunk_text(text: str, max_tokens=CHUNK_TOKENS, overlap=CHUNK_OVERLAP) -> List[str]:
    candidates = re.split(r"\n\s*(?=[A-Z][A-Za-z0-9 ()\-]{2,50}\n)|\n{2,}", text)
    chunks, buff = [], ""
    for piece in candidates:
        piece = piece.strip()
        if not piece:
            continue
        if tokenize_len(buff + ("\n" if buff else "") + piece) <= max_tokens:
            buff = (buff + ("\n" if buff else "") + piece).strip()
        else:
            if buff:
                chunks.append(buff)
            if tokenize_len(piece) <= max_tokens:
                buff = piece
            else:
                words = piece.split()
                start = 0
                step = 300
                while start < len(words):
                    sub = " ".join(words[start:start+step])
                    chunks.append(sub)
                    start += (step - max(0, overlap // 3))
                buff = ""
    if buff:
        chunks.append(buff)

    final: List[str] = []
    for i, c in enumerate(chunks):
        if i == 0:
            final.append(c)
        else:
            prev = final[-1]
            tail = " ".join(prev.split()[-120:])
            merged = (tail + "\n" + c).strip()
            if tokenize_len(merged) <= max_tokens:
                final[-1] = merged
            else:
                final.append(c)
    return final or [text[:2000]]

def extract_text_from_pdf(path: str) -> List[Tuple[int, str]]:
    doc = fitz.open(path)
    pages: List[Tuple[int, str]] = []
    for i in range(len(doc)):
        txt = doc[i].get_text("text") or ""
        pages.append((i+1, txt))
    doc.close()
    return pages

def tag_text(t: str, vocab: Dict[str, List[str]]) -> Optional[str]:
    low = t.lower()
    best, score = None, 0
    for key, terms in vocab.items():
        s = sum(1 for w in terms if w in low)
        if s > score:
            best, score = key, s
    return best

def embed_texts(texts: List[str]) -> np.ndarray:
    # Create client on demand (ensures key exists now)
    client = get_client()
    out = []
    B = 64
    for i in range(0, len(texts), B):
        resp = client.embeddings.create(model=EMBED_MODEL, input=texts[i:i+B])
        out.extend([d.embedding for d in resp.data])
    return np.array(out, dtype="float32")

def build_prompt(question: str, contexts: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """
    Researcher-first prompt with clear, auditable structure.
    Sections:
      1) Explanation (narrative) — walk through what the sources say, with inline [#] citations
      2) Key findings — short bullets, each with citations
      3) Context coverage — which sources support which ideas
      4) Summary — 1–3 sentences
      5) Notes — limitations, disagreements, gaps, next steps
    Formatting is plain Markdown (no bold/italics/tables) to avoid raw ** in UI.
    Always use ONLY the provided context. If not enough evidence, state that.
    """

    # Build the context blocks and source list exactly in order so [1], [2], ... map consistently.
    context_block = "\n\n---\n\n".join(
        [f"[{i+1}] {c['doc_title']} (p.{c.get('page_start','?')})\n{c['text']}"
         for i, c in enumerate(contexts)]
    )
    sources_list = "\n".join([
        f"[{i+1}] {c['doc_title']} ({c.get('year','n.d.')}) — p.{c.get('page_start','?')} | {os.path.basename(c['doc_path'])}"
        for i, c in enumerate(contexts)
    ])

    system = (
        "You are a PhD-level Space Biology researcher supporting PIs and program directors. "
        "Use ONLY the provided context chunks. If the answer is not present in the context, say so plainly. "
        "Be precise, neutral, and concise. Avoid speculation unless clearly qualified.\n\n"

        "Audience: domain researchers and decision makers. Prefer clarity over flair. "
        "Expand acronyms on first use (e.g., International Space Station (ISS)). "
        "Define niche terms briefly when they first appear.\n\n"

        "Output format (plain Markdown; no bold, no italics, no tables):\n"
        "Explanation\n"
        "- A short narrative (2–6 sentences) that walks through what the sources actually say.\n"
        "- Anchor important claims with bracket citations immediately after the claim, e.g., [1], [2].\n"
        "- If quantitative values exist, include them succinctly.\n"
        "Key findings\n"
        "- Bullet points with one concrete claim per bullet; each bullet has bracket citations.\n"
        "Context coverage\n"
        "- Map ideas to the source numbers to show evidence traceability.\n"
        "Summary\n"
        "- 1–3 sentences that directly answer the question at a high level.\n"
        "Notes\n"
        "- Limitations, disagreements, missing evidence, and recommended next queries.\n\n"

        "Formatting rules:\n"
        "- Use headings exactly as: Explanation, Key findings, Context coverage, Summary, Notes.\n"
        "- Use simple hyphen bullets only; no nested lists unless absolutely necessary.\n"
        "- Always include bracket citations that map to the Sources list. "
        "If evidence is insufficient, state it and suggest what to search next.\n"
        "- No emojis. No marketing tone."
    )

    user = (
        f"Question: {question}\n\n"
        f"Context:\n{context_block}\n\n"
        f"Sources:\n{sources_list}\n\n"
        "Remember: Use only the context above. If unknown, say so clearly."
    )

    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
