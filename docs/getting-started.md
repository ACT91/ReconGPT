# Getting Started with ReconGPT

## Prerequisites

### Required Tools
- Docker & Docker Compose
- Python 3.11+
- PostgreSQL 15
- Redis 7

### Recon Tools (Required on Worker Machines)
Install from [ProjectDiscovery](https://github.com/projectdiscovery):
```bash
# Subfinder
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Httpx
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# Katana
go install -v github.com/projectdiscovery/katana/cmd/katana@latest

# Nuclei
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
```

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/ReconGPT.git
cd ReconGPT
```

### 2. Configure Environment
```bash
cp .env.example .env
nano .env  # Edit with your settings
```

Key settings to configure:
```env
# Database
DATABASE_URL=postgresql://recongpt:recongpt123@localhost:5432/recongpt

# AI
OPENAI_API_KEY=sk-your-key-here

# Tool Paths (update based on your installation)
SUBFINDER_PATH=/usr/local/bin/subfinder
HTTPX_PATH=/usr/local/bin/httpx
KATANA_PATH=/usr/local/bin/katana
NUCLEI_PATH=/usr/local/bin/nuclei
```

### 3. Start with Docker Compose
```bash
docker-compose up -d
```

This starts:
- PostgreSQL database
- Redis queue
- FastAPI backend
- Celery worker

### 4. Verify Installation
```bash
# Check services
docker-compose ps

# Check API health
curl http://localhost:8000/health

# Access API docs
open http://localhost:8000/docs
```

## Running Your First Scan

### Via API
```bash
curl -X POST http://localhost:8000/api/v1/scan/start \
  -H "Content-Type: application/json" \
  -d '{
    "target_domain": "example.com",
    "user_id": "test-user"
  }'
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Scan queued for example.com"
}
```

### Monitor Progress
```bash
# Get status
curl http://localhost:8000/api/v1/scan/550e8400-e29b-41d4-a716-446655440000

# Watch logs
curl http://localhost:8000/api/v1/scan/550e8400-e29b-41d4-a716-446655440000/logs
```

### Get Results
```bash
curl http://localhost:8000/api/v1/results/550e8400-e29b-41d4-a716-446655440000
```

## Manual Setup (Without Docker)

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Start PostgreSQL & Redis
```bash
# PostgreSQL
createdb recongpt

# Redis
redis-server
```

### 3. Run Backend
```bash
cd backend
uvicorn app.main:app --reload
```

### 4. Run Worker (Separate Terminal)
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

## Development Workflow

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black backend/
isort backend/
```

### Type Checking
```bash
mypy backend/
```

## Common Issues

### Issue: "Tool not found"
**Solution:** Install recon tools and update paths in `.env`

### Issue: "Cannot connect to database"
**Solution:** Ensure PostgreSQL is running and DATABASE_URL is correct

### Issue: "Redis connection failed"
**Solution:** Start Redis: `redis-server`

### Issue: "Worker not processing jobs"
**Solution:** Check Celery logs: `celery -A app.tasks.celery_app worker --loglevel=debug`

## Next Steps

- Read [Architecture Documentation](architecture.md)
- Explore [Pipeline Details](pipeline.md)
- Check [API Reference](api.md)
- Join community discussions

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Full docs in `/docs`
- Examples: Sample scripts in `/examples`
