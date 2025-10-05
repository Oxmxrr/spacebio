FROM python:3.11-slim

# system deps for PyAV/FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    gcc \
    libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev \
    libavfilter-dev libswscale-dev libswresample-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PORT=10000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "10000"]
