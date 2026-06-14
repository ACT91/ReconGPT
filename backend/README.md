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

#### Authentication (`/api/v1/auth`)
- `POST /login` - Login with email/password
- `POST /register` - Register new user
- `POST /refresh` - Refresh access token
- `GET /me` - Get current user
- `POST /change-password` - Change password
- `POST /api-keys` - Create API key
- `GET /api-keys` - List API keys
- `DELETE /api-keys/{id}` - Revoke API key

#### Projects (`/api/v1/projects`)
- `POST /projects` - Create project
- `GET /projects` - List projects
- `GET /projects/{id}` - Get project
- `GET /projects/{id}/stats` - Get project statistics
- `PATCH /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

#### Scans (`/api/v1/scans`)
- `POST /scans/start` - Start new scan
- `GET /scans` - List scans
- `GET /scans/{id}` - Get scan status
- `GET /scans/{id}/progress` - Get detailed progress
- `GET /scans/{id}/logs` - Get scan logs
- `GET /scans/{id}/logs/stream` - Stream logs (SSE)
- `GET /scans/{id}/results` - Get full results
- `GET /scans/{id}/subdomains` - Get subdomains
- `GET /scans/{id}/vulnerabilities` - Get vulnerabilities
- `POST /scans/{id}/cancel` - Cancel scan
- `POST /scans/{id}/retry` - Retry scan

#### Results (`/api/v1/results`)
- `GET /results/{id}/overview` - Results overview
- `GET /results/{id}` - Full scan results
- `GET /results/{id}/stats` - Aggregated statistics
- `GET /results/{id}/graph` - Attack surface graph data

#### Insights (`/api/v1/insights`)
- `GET /insights/{job_id}` - List AI insights
- `GET /insights/{job_id}/executive-summary` - Executive summary
- `GET /insights/{job_id}/risk-score` - Risk score breakdown
- `GET /insights/{job_id}/attack-vectors` - Attack vectors
- `GET /insights/{job_id}/{insight_id}` - Insight detail
- `PATCH /insights/{job_id}/{insight_id}` - Update insight

## Pipeline Stages

The reconnaissance pipeline consists of 13 sequential stages:

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