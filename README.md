## Space Biology Knowledge Engine

An end-to-end RAG application for exploring space biology literature. It includes:
- **Backend**: FastAPI service with semantic search (FAISS), Q&A, mind map and storytelling generation, plus speech I/O (TTS/STT).
- **Frontend**: Vite + React + React Query UI to search, browse a library, ask questions, build mind maps, generate stories, and play/record audio.

### Repository structure
- `backend/`: FastAPI app and data processing
  - `app.py`: API server (search, ask, library, mindmap, story, TTS/STT, stats)
  - `rag_core.py`: OpenAI client, embeddings, PDF parsing, prompting
  - `ingest.py`: Build FAISS index (`data/index/`) from PDFs under `data/pdfs/`
  - `speech_io.py`: Piper TTS and faster‑whisper STT helpers
  - `models/piper/`: Piper voice/model files (e.g., `en_US-amy-low.onnx`)
  - `data/`: runtime assets
    - `pdfs/`: put source PDFs here
    - `index/`: FAISS index and metadata (`index.faiss`, `meta.jsonl`)
    - `audio/`: synthesized WAV files from TTS
- `frontend/`: Vite React app
  - `src/hooks/useApi.ts`: API client; uses `VITE_API_BASE` for backend URL

### Requirements
- Python 3.10+
- Node 18+ (or 20+ recommended)
- Windows (project includes Piper Windows binaries); Linux/macOS can work with appropriate Piper binaries or skipping TTS

### Quick start
1) Backend setup
```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

2) Environment variables (create `.env` in `backend/`)
- You must create your own OpenAI API key and set it here.
- **IMPORTANT**: Set a password to protect your API when hosting online!
```
# Required
OPENAI_API_KEY=sk-your-key-here

# SECURITY: Set a password to protect your API (required for production!)
APP_PASSWORD=your-strong-password-here

# Optional: JWT settings
# JWT_SECRET_KEY=your-random-secret-key  # Auto-generated if not set
# JWT_EXPIRE_MINUTES=1440  # 24 hours default (token expiration)

# Optional (defaults shown)
CHAT_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
BOOT_MODE=light             # light|full; full loads FAISS at startup
ALLOWED_ORIGINS=*           # comma-separated list for CORS (restrict in production!)

# TTS/STT options
PIPER_EXE=models/piper/piper.exe
PIPER_VOICE=en_US-amy-low.onnx
PIPER_USE_CUDA=false        # true to enable if GPU-supported
WHISPER_MODEL_SIZE=small    # tiny|base|small|medium|large-v3
WHISPER_USE_CUDA=auto       # true|false|auto
```

3) Ingest PDFs (for semantic search and Q&A)
- Place your PDFs under `backend/data/pdfs/`.
- Build the metadata and FAISS index:
```
cd backend
venv\Scripts\activate
python ingest.py
```
This writes `data/index/meta.jsonl` and `data/index/index.faiss`.

4) Run the backend
```
cd backend
venv\Scripts\activate
$env:BOOT_MODE = "full" (powershell)
uvicorn app:app --reload --port 8000
```
You should see logs like:
```
[startup] BOOT_MODE=light | faiss=yes | index_loaded=no | meta_rows=....
```
Set `BOOT_MODE=full` and re-run if you want semantic endpoints to be active and FAISS loaded.

5) Run the frontend
```
cd frontend
npm install
# (optional) set backend base; defaults to http://localhost:8000
# create .env and set: VITE_API_BASE=http://localhost:8000
npm run dev
```
Open `http://localhost:5173/`.

### Configuration
- Backend reads `.env` in `backend/` (via `python-dotenv`). Critical key:
  - OPENAI_API_KEY: Create your own API key in your OpenAI account and set it here.
- Frontend reads `.env` in `frontend/`:
```
VITE_API_BASE=http://localhost:8000
```

### API overview (backend)
- System
  - `GET /` — service info
  - `GET /health` — health check
  - `GET /ping` — status and vector count
  - `GET /gpu` — GPU/provider info
  - `GET /stats` — frequency summaries and chunk counts
- Library
  - `GET /library?q&organism&stressor&platform&page&page_size&sort&order` — browse `meta.jsonl`
- Semantic search and Q&A (require FAISS and `BOOT_MODE=full`)
  - `GET /search?q&top_k` — top‑k results with scores
  - `POST /ask` — JSON body `{ question, top_k, organism?, stressor?, platform? }`
  - `POST /ask-simple` — JSON body `{ question, top_k }`, optional `?tts=true`
- Mind map and storytelling
  - `POST /mindmap` — build concept graph from context
  - `POST /story` — build markdown story and outline (alias: `POST /storytelling`)
- Speech I/O
  - `GET /tts/voices` — list available Piper voices in `models/piper/`
  - `POST /tts` — `{ text, voice? }` → `{ audio_url, file_path }`
  - `POST /stt` — multipart form file `file` → `{ text }`

### Data locations
- Input PDFs: `backend/data/pdfs/`
- Index + metadata: `backend/data/index/`
- TTS audio output: `backend/data/audio/`
- Piper models: `backend/models/piper/`

### Notes on FAISS and modes
- `BOOT_MODE=light`: skips loading FAISS index at startup (fast boot; library browsing works).
- `BOOT_MODE=full`: loads FAISS index; enables `/search`, `/ask`, `/ask-simple`, `/mindmap`, `/story` with semantic context.

### Troubleshooting
- Missing OpenAI key: If you see `OPENAI_API_KEY not set`, add it to `backend/.env`.
- Index missing: `/search` or `/ask` returns an error — ensure `BOOT_MODE=full` and run `python ingest.py`.
- Piper errors on Windows: verify `models/piper/piper.exe` and voice files exist; set `PIPER_EXE`/`PIPER_VOICE` paths correctly.
- CORS errors in the browser: set `ALLOWED_ORIGINS` to your frontend origin (e.g., `http://localhost:5173`).
- Slow STT on CPU: set `WHISPER_USE_CUDA=true` if your system supports CUDA via CTranslate2.

### Deployment tips
- Set environment variables securely (do not commit `.env`).
- Persist `data/index/` artifacts or rebuild at deploy time.
- Restrict `ALLOWED_ORIGINS` in production.

### Security (Production Deployment)

When hosting this application online, you MUST enable authentication to protect your OpenAI API key from unauthorized use:

1. **Set a strong password** in your environment variables:
   ```
   APP_PASSWORD=your-very-strong-password-here
   ```

2. **Restrict CORS origins** to your frontend domain:
   ```
   ALLOWED_ORIGINS=https://your-frontend-domain.com
   ```

3. **Rate limiting** is enabled by default to prevent abuse:
   - Login attempts: 5/minute (prevents brute force)
   - Search/Ask: 20-30/minute
   - Mindmap/Story generation: 10/minute

4. **JWT tokens** are used for authentication:
   - Tokens expire after 24 hours by default
   - Set `JWT_EXPIRE_MINUTES` to customize expiration
   - Set `JWT_SECRET_KEY` for consistent tokens across restarts

5. **Never commit your `.env` file** - it's already in `.gitignore`

Example production `.env`:
```
OPENAI_API_KEY=sk-your-key-here
APP_PASSWORD=MySecurePassword123!
JWT_SECRET_KEY=random-32-char-secret-key-here
ALLOWED_ORIGINS=https://myapp.vercel.app
BOOT_MODE=full
```

### License
Provide license terms here if applicable.


