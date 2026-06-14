# Reconny Backend

AI-powered Attack Surface Management and Reconnaissance Automation Platform - Backend API.

## Tech Stack

- **Framework**: FastAPI (async)
- **Database**: PostgreSQL 15 + SQLAlchemy 2.0 (async) + Alembic
- **Task Queue**: Celery + Redis
- **AI**: OpenAI GPT-4o / GPT-4-turbo
- **Security**: JWT + bcrypt + API Keys
- **Logging**: structlog (structured JSON)
- **Container**: Docker + docker-compose

## Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Security tools (optional): subfinder, httpx, katana, nuclei, gau

## Quick Start

### 1. Clone and Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Database Migrations

```bash
alembic upgrade head
```

### 4. Start the API Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Start Celery Worker (in another terminal)

```bash
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

## Docker Setup

```bash
docker-compose up -d
```

This starts:
- PostgreSQL 15
- Redis 7
- FastAPI backend on port 8000
- Celery worker
- Flower (Celery monitoring) on port 5555

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### API Endpoints

All endpoints are prefixed with `/api/v1`.

#### Authentication (`/api/v1/auth`)
- `POST /login` - Login with email/password → returns `access_token`, `refresh_token`
- `POST /register` - Register new user
- `POST /refresh` - Refresh access token using refresh token
- `GET /me` - Get current authenticated user
- `POST /change-password` - Change password
- `POST /api-keys` - Create API key (returns full key once)
- `GET /api-keys` - List API keys (truncated prefixes)
- `DELETE /api-keys/{id}` - Revoke API key
- `POST /logout` - Logout (client-side token removal)

#### Projects (`/api/v1/projects`)
- `POST /projects` - Create project
- `GET /projects` - List projects (paginated)
- `GET /projects/{id}` - Get project
- `GET /projects/{id}/stats` - Get project statistics
- `PATCH /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

#### Scans (`/api/v1/scans`)
- `POST /scans/start` - Start new scan (rate-limited)
- `GET /scans` - List scans (paginated, sortable: `?sort=created_at:desc&search=domain&page=1&page_size=20`)
- `GET /scans/{id}` - Get scan status
- `GET /scans/{id}/progress` - Get detailed progress (per-stage)
- `GET /scans/{id}/logs` - Get scan logs (paginated, filterable by stage/level)
- `GET /scans/{id}/logs/stream` - Stream logs via SSE (Server-Sent Events)
- **`WS /scans/{id}/ws`** - WebSocket endpoint for real-time progress, logs, and status updates
- `GET /scans/{id}/results` - Get full results
- `GET /scans/{id}/subdomains` - Get subdomains (paginated)
- `GET /scans/{id}/vulnerabilities` - Get vulnerabilities (paginated, filterable by severity)
- `POST /scans/{id}/cancel` - Cancel scan (revokes Celery task)
- `POST /scans/{id}/retry` - Retry failed scan

#### Results (`/api/v1/results`)
- `GET /results/{id}/overview` - Results overview
- `GET /results/{id}` - Full scan results (all categories)
- `GET /results/{id}/stats` - Aggregated statistics
- `GET /results/{id}/graph` - Attack surface graph data (for ReactFlow visualization)

#### Insights (`/api/v1/insights`)
- `GET /insights/{job_id}` - List AI insights (paginated, filterable by type/priority)
- `GET /insights/{job_id}/executive-summary` - Executive summary
- `GET /insights/{job_id}/risk-score` - Risk score breakdown
- `GET /insights/{job_id}/attack-vectors` - Attack vectors
- `GET /insights/{job_id}/{insight_id}` - Insight detail
- `PATCH /insights/{job_id}/{insight_id}` - Update insight (dismiss, etc.)

### Authentication Flow

Reconny supports two authentication methods:

1. **JWT Tokens** (primary):
   - Login → receive `access_token` (30min) + `refresh_token` (7 days)
   - Pass `Authorization: Bearer <token>` header
   - Use `/auth/refresh` to get new tokens before expiration
   - Tokens contain `sub` (user ID), `email`, `role`

2. **API Keys** (for programmatic access):
   - Create via `/auth/api-keys` → receives full key once (prefix: `rky_`)
   - Pass `X-API-Key: <key>` header
   - Keys can be revoked, have optional expiration

### Rate Limiting

- **Global**: 100 requests per 60 seconds per user
- **Scan rate limit**: 10 scan starts per hour per user
- **Concurrent scans**: Maximum 3 concurrent scans per user
- All rate limits return `429 Too Many Requests` with `Retry-After` header

### WebSocket Usage

Connect to `/api/v1/scans/{job_id}/ws` with authentication to receive real-time updates:

```json
// Progress update
{
  "job_id": "<uuid>",
  "type": "progress",
  "stage": "subdomain_enum",
  "progress": 45.0,
  "message": "Processing batch 3/8",
  "timestamp": 1234567890.123
}

// Log entry
{
  "job_id": "<uuid>",
  "type": "log",
  "stage": "subdomain_enum",
  "level": "info",
  "message": "Found 150 subdomains via Subfinder",
  "details": {"source": "subfinder"},
  "timestamp": 1234567890.123
}

// Status change
{
  "job_id": "<uuid>",
  "type": "status",
  "status": "running",
  "error": null,
  "timestamp": 1234567890.123
}
```

### Error Handling

All errors return a consistent JSON format:
```json
{
  "error": "Human-readable error title",
  "detail": "Detailed error description",
  "code": "ERROR_CODE"
}
```

Common error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMIT_EXCEEDED`, `TOOL_EXECUTION_ERROR`, `PIPELINE_ERROR`, `DOMAIN_NOT_ALLOWED`

| # | Stage | Tool | Description |
|---|-------|------|-------------|
| 1 | Subdomain Enumeration | Subfinder + Gau | Enumerate subdomains from multiple sources |
| 2 | Live Host Probing | Httpx | Check which subdomains are alive |
| 3 | Technology Detection | Httpx | Detect technologies and frameworks |
| 4 | Web Crawling | Katana | Crawl live hosts for URLs |
| 5 | JavaScript Extraction | Custom | Extract JavaScript file URLs |
| 6 | Endpoint Extraction | Custom | Extract API endpoints from crawl |
| 7 | JavaScript Downloading | HTTPX | Download JS files locally |
| 8 | Static JS Analysis | Custom | Find hidden endpoints, secrets, APIs |
| 9 | Endpoint Merge | Custom | Deduplicate all endpoints |
| 10 | URL Reconstruction | Custom | Build full URLs from paths |
| 11 | Endpoint Probing | Httpx | Probe all discovered endpoints |
| 12 | Vulnerability Scanning | Nuclei | Scan for known vulnerabilities |
| 13 | AI Analysis | GPT-4o | Generate insights and risk scoring |

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application
│   ├── ai/                        # AI analysis layer
│   │   ├── analyzer.py            # Scan result analysis
│   │   ├── prompts.py             # AI prompts
│   │   └── service.py             # AI service & insight generation
│   ├── api/
│   │   ├── routes/                # API routes
│   │   │   ├── auth.py            # JWT authentication
│   │   │   ├── projects.py        # Project CRUD
│   │   │   ├── scans.py           # Scan management
│   │   │   ├── results.py         # Scan results & stats
│   │   │   └── insights.py        # AI insights
│   │   └── deps.py                # Dependencies (auth, rate limiting)
│   ├── core/
│   │   ├── config.py              # Pydantic settings
│   │   ├── database.py            # Async SQLAlchemy setup
│   │   ├── logger.py              # structlog logging
│   │   └── security.py            # JWT, bcrypt, API keys
│   ├── integrations/              # Tool wrappers
│   │   ├── subfinder.py           # Subdomain enumeration
│   │   ├── httpx.py               # HTTP probing
│   │   ├── katana.py              # Web crawling
│   │   ├── nuclei.py              # Vulnerability scanning
│   │   └── gau.py                 # URL gathering
│   ├── models/                    # SQLAlchemy models
│   │   ├── user.py                # User & APIKey
│   │   ├── project.py             # Project
│   │   ├── job.py                 # ScanJob
│   │   ├── subdomain.py           # Subdomain
│   │   ├── endpoint.py            # Endpoint
│   │   ├── js_file.py             # JsFile
│   │   ├── vulnerability.py       # Vulnerability
│   │   ├── ai_insight.py          # AiInsight
│   │   └── pipeline_log.py        # PipelineLog
│   ├── pipeline/
│   │   ├── base_stage.py          # Abstract pipeline stage
│   │   └── stages/                # 13 pipeline stage implementations
│   ├── schemas/                   # Pydantic v2 schemas
│   │   ├── common.py              # Shared schemas
│   │   ├── auth.py                # Auth schemas
│   │   ├── project.py             # Project schemas
│   │   ├── scan.py                # Scan schemas
│   │   ├── result.py              # Result schemas
│   │   └── insight.py             # Insight schemas
│   ├── services/                  # Business logic
│   │   ├── auth.py                # Authentication service
│   │   └── scan.py                # Scan service
│   ├── tasks/                     # Celery tasks
│   │   ├── celery_app.py          # Celery configuration
│   │   └── scan_tasks.py          # Pipeline tasks
│   └── utils/
│       └── subprocess_runner.py   # Async subprocess execution
├── alembic/                       # Database migrations
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Configuration

All configuration is managed through environment variables. See `.env.example` for all available options.

## Authentication

Reconny supports two authentication methods:
1. **JWT Tokens**: Standard Bearer token authentication
2. **API Keys**: Using `X-API-Key` header (prefix: `rky_`)

## Development

### Run Tests
```bash
pytest tests/ -v --cov=app
```

### Code Quality
```bash
black .
isort .
ruff check .
mypy app/
```

### Database Migrations
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## License

MIT