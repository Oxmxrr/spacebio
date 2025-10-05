# ingest.py
import os, json, time
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import faiss

from rag_core import (
    extract_text_from_pdf, chunk_text, tag_text,
    ORGANISMS, STRESSORS, PLATFORMS, embed_texts
)
from importlib.metadata import version, PackageNotFoundError
try:
    LIB_VER = version("ctranslate2")  # or whichever package you were checking
except PackageNotFoundError:
    LIB_VER = "0.0.0"

DATA_DIR = "data/pdfs"
IDX_DIR  = "data/index"
META_PATH = os.path.join(IDX_DIR, "meta.jsonl")
FAISS_PATH = os.path.join(IDX_DIR, "index.faiss")

def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(IDX_DIR, exist_ok=True)

def guess_title_year(path: str, pages: List[Tuple[int,str]]) -> Tuple[str, Optional[str]]:
    first_page_lines = pages[0][1].splitlines()[:10] if pages else []
    title = next((l.strip() for l in first_page_lines if len(l.strip()) > 10), os.path.basename(path))
    year = None
    for l in first_page_lines:
        for y in range(1980, 2036):
            if str(y) in l:
                year = str(y); break
        if year: break
    return title, year

def run_ingest():
    ensure_dirs()
    pdfs = [os.path.join(DATA_DIR, f) for f in os.listdir(DATA_DIR) if f.lower().endswith(".pdf")]
    if not pdfs:
        print(f"No PDFs found in {DATA_DIR}. Place files and retry.")
        return

    records: List[Dict[str, Any]] = []
    texts_for_embed: List[str] = []
    cursor = 0

    print(f"Found {len(pdfs)} PDFs")
    for p in pdfs:
        pages = extract_text_from_pdf(p)
        if not any(t for _, t in pages):
            print(f"Skip (no text): {p}")
            continue

        title, year = guess_title_year(p, pages)
        full_text = "\n".join([t for _, t in pages])
        organism = tag_text(full_text, ORGANISMS)
        stressor = tag_text(full_text, STRESSORS)
        platform = tag_text(full_text, PLATFORMS)

        for page_no, page_txt in pages:
            if not page_txt.strip():
                continue
            chunks = chunk_text(page_txt)
            for ch in chunks:
                rec = {
                    "id": cursor,
                    "doc_path": p,
                    "doc_title": title,
                    "year": year,
                    "page_start": page_no,
                    "page_end": page_no,
                    "organism": organism,
                    "stressor": stressor,
                    "platform": platform,
                    "text": ch
                }
                records.append(rec)
                texts_for_embed.append(ch)
                cursor += 1

    if not records:
        print("No content parsed. Exiting.")
        return

    print(f"Embedding {len(records)} chunks...")
    embs = embed_texts(texts_for_embed)
    faiss.normalize_L2(embs)
    dim = embs.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embs)

    print(f"Saving index -> {FAISS_PATH}")
    faiss.write_index(index, FAISS_PATH)

    print(f"Writing metadata -> {META_PATH}")
    with open(META_PATH, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"Done. {index.ntotal} vectors indexed.")

if __name__ == "__main__":
    t0 = time.time()
    run_ingest()
    print(f"Ingest finished in {time.time()-t0:.1f}s")
