# app_mindmap_story.py (or append to app.py)

from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# ---------- MindMap ----------
class MindMapSource(BaseModel):
    title: str
    year: Optional[str] = None
    page: Optional[int] = None
    path: str
    snippet: str

class MindMapNode(BaseModel):
    id: str                 # canonical ID (slug)
    label: str              # human readable
    kind: str               # e.g., "organism" | "stressor" | "platform" | "method" | "gene" | "concept"
    weight: float = 1.0

class MindMapEdge(BaseModel):
    source: str
    target: str
    relation: str           # e.g., "affects", "measured_in", "associated_with"
    weight: float = 1.0

class MindMapRequest(BaseModel):
    question: Optional[str] = None
    top_k: int = 20
    organism: Optional[str] = None
    stressor: Optional[str] = None
    platform: Optional[str] = None
    paths: Optional[List[str]] = None  # optional explicit selection (doc_path list)

class MindMapResponse(BaseModel):
    nodes: List[MindMapNode]
    edges: List[MindMapEdge]
    supportByNode: Dict[str, List[MindMapSource]]

# ---------- Storytelling ----------
class StoryRequest(BaseModel):
    question: Optional[str] = None
    mode: str = "scientific"   # "scientific" | "public" | "chronological" | "thematic"
    length: str = "short"      # "short" (~400-600 words) | "medium" | "long"
    top_k: int = 15
    organism: Optional[str] = None
    stressor: Optional[str] = None
    platform: Optional[str] = None
    paths: Optional[List[str]] = None   # user-selected documents

class StoryOutlineItem(BaseModel):
    heading: str
    key_points: List[str]

class StoryResponse(BaseModel):
    markdown: str
    outline: List[StoryOutlineItem]
    sources: List[MindMapSource]
