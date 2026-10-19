FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

COPY wine-tracker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Unprivileged runtime user. Host bind mounts for /data must be owned by
# UID/GID 10001 (see DEPLOY.md).
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p /data/wine-tracker \
    && chown -R 10001:10001 /data

# Application code stays root-owned and read-only for the app user.
COPY wine-tracker/app/ .

VOLUME /data
ENV DATA_DIR=/data/wine-tracker

USER 10001:10001

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5050/healthz', timeout=4)"]

CMD ["python3", "app.py"]
