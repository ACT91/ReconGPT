FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim AS tools

RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    tar \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG TARGETARCH=amd64

RUN LATEST_URL=$(curl -s https://api.github.com/repos/projectdiscovery/subfinder/releases/latest | grep browser_download_url | grep linux_${TARGETARCH} | grep -v '\.md5$\|\.sha256$' | head -1 | cut -d '"' -f 4) && \
    echo "Downloading subfinder from $LATEST_URL" && \
    curl -sL "$LATEST_URL" -o /tmp/subfinder.zip && \
    unzip -o /tmp/subfinder.zip -d /tmp/subfinder && \
    mv /tmp/subfinder/subfinder /usr/local/bin/subfinder && \
    rm -rf /tmp/subfinder.zip /tmp/subfinder

RUN LATEST_URL=$(curl -s https://api.github.com/repos/projectdiscovery/httpx/releases/latest | grep browser_download_url | grep linux_${TARGETARCH} | grep -v '\.md5$\|\.sha256$' | head -1 | cut -d '"' -f 4) && \
    echo "Downloading httpx from $LATEST_URL" && \
    curl -sL "$LATEST_URL" -o /tmp/httpx.zip && \
    unzip -o /tmp/httpx.zip -d /tmp/httpx && \
    mv /tmp/httpx/httpx /usr/local/bin/httpx && \
    rm -rf /tmp/httpx.zip /tmp/httpx

RUN LATEST_URL=$(curl -s https://api.github.com/repos/projectdiscovery/katana/releases/latest | grep browser_download_url | grep linux_${TARGETARCH} | grep -v '\.md5$\|\.sha256$' | head -1 | cut -d '"' -f 4) && \
    echo "Downloading katana from $LATEST_URL" && \
    curl -sL "$LATEST_URL" -o /tmp/katana.zip && \
    unzip -o /tmp/katana.zip -d /tmp/katana && \
    mv /tmp/katana/katana /usr/local/bin/katana && \
    rm -rf /tmp/katana.zip /tmp/katana

RUN LATEST_URL=$(curl -s https://api.github.com/repos/projectdiscovery/nuclei/releases/latest | grep browser_download_url | grep linux_${TARGETARCH} | grep -v '\.md5$\|\.sha256$' | head -1 | cut -d '"' -f 4) && \
    echo "Downloading nuclei from $LATEST_URL" && \
    curl -sL "$LATEST_URL" -o /tmp/nuclei.zip && \
    unzip -o /tmp/nuclei.zip -d /tmp/nuclei && \
    mv /tmp/nuclei/nuclei /usr/local/bin/nuclei && \
    rm -rf /tmp/nuclei.zip /tmp/nuclei

RUN LATEST_URL=$(curl -s https://api.github.com/repos/lc/gau/releases/latest | grep browser_download_url | grep linux_${TARGETARCH} | grep -v '\.md5$\|\.sha256$' | head -1 | cut -d '"' -f 4) && \
    echo "Downloading gau from $LATEST_URL" && \
    mkdir -p /tmp/gau && \
    curl -sL "$LATEST_URL" -o /tmp/gau.tar.gz && \
    tar -xzf /tmp/gau.tar.gz -C /tmp/gau && \
    mv /tmp/gau/gau /usr/local/bin/gau && \
    rm -rf /tmp/gau.tar.gz /tmp/gau

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
COPY --from=tools /usr/local/bin/subfinder /usr/local/bin/subfinder
COPY --from=tools /usr/local/bin/httpx /usr/local/bin/httpx
COPY --from=tools /usr/local/bin/katana /usr/local/bin/katana
COPY --from=tools /usr/local/bin/nuclei /usr/local/bin/nuclei
COPY --from=tools /usr/local/bin/gau /usr/local/bin/gau

ENV PATH=/root/.local/bin:$PATH \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1

RUN mkdir -p /app/storage/jobs /app/logs /app/alembic

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]