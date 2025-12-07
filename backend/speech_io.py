# speech_io.py (CLI-based Piper for Windows + faster-whisper STT)
import os, uuid, subprocess, tempfile, importlib
from typing import Tuple, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# ---------- Config ----------
PIPER_DIR       = os.path.join("models", "piper")
PIPER_EXE       = os.getenv("PIPER_EXE", os.path.join(PIPER_DIR, "piper.exe"))
PIPER_VOICE     = os.getenv("PIPER_VOICE", "en_US-amy-low.onnx")
# Accepts: true/false/auto (auto = prefer CUDA if available)
PIPER_USE_CUDA  = os.getenv("PIPER_USE_CUDA", "false").strip().lower() in ("1", "true", "yes", "y")

def _ensure_paths(voice_name: str):
    exe_path = PIPER_EXE
    if not os.path.exists(exe_path):
        raise RuntimeError(f"piper.exe not found at: {exe_path}")
    onnx_path = os.path.join(PIPER_DIR, voice_name)
    cfg_path  = onnx_path + ".json"
    if not os.path.exists(onnx_path) or not os.path.exists(cfg_path):
        raise RuntimeError(f"Voice files missing: {onnx_path} (+ .json)")
    return exe_path, onnx_path, cfg_path

# ---------- TTS via Piper CLI ----------
def tts_piper_to_wav(text: str, out_dir: str = os.path.join("data", "audio"),
                     voice_name: str = None) -> Tuple[str, str]:
    exe_path, onnx_path, cfg_path = _ensure_paths(voice_name or PIPER_VOICE)
    os.makedirs(out_dir, exist_ok=True)
    file_id  = str(uuid.uuid4())
    wav_path = os.path.join(out_dir, f"{file_id}.wav")

    # Write a tiny temp input file so Windows stdin quirks never bite us
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt", encoding="utf-8") as tf:
        tf.write(text.strip() + "\n")
        tf.flush()
        in_path = tf.name

    # Build the Piper command
    # Usage (typical): piper -m MODEL -c CONFIG -i INPUT_FILE -f OUTPUT_FILE [--cuda]
    cmd = [
        exe_path, "-m", onnx_path, "-c", cfg_path,
        "-i", in_path, "-f", wav_path
    ]
    if PIPER_USE_CUDA:
        cmd.append("--cuda")

    try:
        # Run Piper and capture stderr for debugging
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"Piper synthesis failed (code {e.returncode}).\n"
            f"CMD: {' '.join(cmd)}\nSTDERR:\n{e.stderr.decode('utf-8', errors='ignore')}"
        )
    finally:
        try:
            os.remove(in_path)
        except Exception:
            pass

    url_path = f"/audio/{os.path.basename(wav_path)}"
    return wav_path, url_path

# ---------- STT (faster-whisper) ----------
from faster_whisper import WhisperModel
_WHISPER_MODEL = None

def _has_cuda_ctranslate2() -> bool:
    """Returns True if CTranslate2 sees >=1 CUDA device."""
    try:
        ct = importlib.import_module("ctranslate2")
        return getattr(ct, "get_cuda_device_count", lambda: 0)() > 0
    except Exception:
        return False

def _pick_whisper_device() -> str:
    """
    Decide CUDA vs CPU for Whisper:
      - WHISPER_USE_CUDA=true => cuda if available, else cpu
      - WHISPER_USE_CUDA=false => cpu
      - WHISPER_USE_CUDA=auto (default if unset) => cuda if available, else cpu
    """
    pref = os.getenv("WHISPER_USE_CUDA", "auto").strip().lower()
    if pref in ("1","true","yes","y"):
        return "cuda" if _has_cuda_ctranslate2() else "cpu"
    if pref in ("0","false","no","n"):
        return "cpu"
    # auto
    return "cuda" if _has_cuda_ctranslate2() else "cpu"

def _get_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        size    = os.getenv("WHISPER_MODEL_SIZE", "small")  # tiny|base|small|medium|large-v3
        device  = _pick_whisper_device()
        # int8 is fast on CPU; float16 is typical for CUDA
        compute = "float16" if device == "cuda" else "int8"
        _WHISPER_MODEL = WhisperModel(size, device=device, compute_type=compute)
    return _WHISPER_MODEL

def stt_transcribe(audio_path: str) -> str:
    model = _get_whisper_model()
    segments, info = model.transcribe(audio_path, beam_size=1)
    return " ".join(seg.text.strip() for seg in segments).strip()

# ---------- GPU Status Helper (for /gpu endpoint) ----------
def gpu_status() -> Dict[str, Any]:
    out: Dict[str, Any] = {}

    # CTranslate2 CUDA detection (used by faster-whisper)
    try:
        import ctranslate2 as ct
        out["ctranslate2_cuda_devices"] = getattr(ct, "get_cuda_device_count", lambda: 0)()
    except Exception as e:
        out["ctranslate2_error"] = str(e)

    # ONNX Runtime providers (what Piper would use; if Piper exe is linked dynamically)
    try:
        import onnxruntime as ort
        out["onnxruntime_providers"] = ort.get_available_providers()
    except Exception as e:
        out["onnxruntime_error"] = str(e)

    # Flags from env
    out["WHISPER_USE_CUDA"] = os.getenv("WHISPER_USE_CUDA", "auto")
    out["PIPER_USE_CUDA"]   = os.getenv("PIPER_USE_CUDA", "false")
    return out
def _get_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        size    = os.getenv("WHISPER_MODEL_SIZE", "small")
        device  = _pick_whisper_device()
        compute = "float16" if device == "cuda" else "int8"

        print(f"[whisper] loading model={size} device={device} compute_type={compute}")
        _WHISPER_MODEL = WhisperModel(size, device=device, compute_type=compute)

    return _WHISPER_MODEL
