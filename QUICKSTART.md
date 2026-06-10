# ReconGPT Quick Start (5 Minutes)

## Step 1: Prerequisites Check (1 min)

```bash
# Check Docker
docker --version

# Check Docker Compose
docker-compose --version

# Clone repo
git clone https://github.com/yourusername/ReconGPT.git
cd ReconGPT
```

## Step 2: Configuration (2 min)

```bash
# Copy environment template
cp .env.example .env

# Edit .env - REQUIRED CHANGES:
# 1. Set OPENAI_API_KEY=sk-your-actual-key
# 2. Update tool paths if not using Docker
nano .env
```

## Step 3: Start Services (1 min)

```bash
# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps

# Should see:
# - recongpt-postgres (port 5432)
# - recongpt-redis (port 6379)
# - recongpt-backend (port 8000)
# - recongpt-worker
```

## Step 4: Run First Scan (1 min)

```bash
# Start a scan
curl -X POST http://localhost:8000/api/v1/scan/start \
  -H "Content-Type: application/json" \
  -d '{
    "target_domain": "example.com",
    "user_id": "test-user"
  }'

# Save the job_id from response
```

## Step 5: Monitor & Results

```bash
# Check status (replace JOB_ID)
curl http://localhost:8000/api/v1/scan/JOB_ID

# Get results when completed
curl http://localhost:8000/api/v1/results/JOB_ID
```

## Interactive API Docs

Open in browser: **http://localhost:8000/docs**

Try the API directly from Swagger UI!

---

## Common Commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f worker

# Restart services
docker-compose restart

# Stop everything
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## Without Docker (Manual Setup)

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Start PostgreSQL (separate terminal)
createdb recongpt

# Start Redis (separate terminal)
redis-server

# Run backend (separate terminal)
uvicorn app.main:app --reload

# Run worker (separate terminal)
celery -A app.tasks.celery_app worker --loglevel=info
```

---

## Install Recon Tools (Required)

```bash
# Install Go first
go version

# Install ProjectDiscovery tools
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/katana/cmd/katana@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# Verify installations
subfinder -version
httpx -version
katana -version
nuclei -version
```

---

## Troubleshooting

**"Connection refused"**
```bash
docker-compose ps  # Check if services are running
docker-compose logs backend  # Check backend logs
```

**"Tool not found"**
```bash
# Update .env with correct tool paths
which subfinder  # Get actual path
```

**"Worker not processing"**
```bash
docker-compose logs worker  # Check worker logs
```

---

## Next Steps

1. Read [docs/architecture.md](docs/architecture.md) - Understand system design
2. Read [docs/pipeline.md](docs/pipeline.md) - Learn pipeline stages
3. Read [docs/api.md](docs/api.md) - Full API reference
4. Explore code in `backend/app/pipeline/stages/` - See how stages work

---

## Example Scan Workflow

```bash
# 1. Create project
curl -X POST http://localhost:8000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "name": "Bug Bounty Program",
    "description": "Security testing"
  }'

# 2. Start scan in project
curl -X POST http://localhost:8000/api/v1/scan/start \
  -H "Content-Type: application/json" \
  -d '{
    "target_domain": "example.com",
    "user_id": "test-user",
    "project_id": "PROJECT_ID_FROM_STEP_1"
  }'

# 3. Monitor progress
watch -n 2 'curl -s http://localhost:8000/api/v1/scan/JOB_ID | jq'

# 4. Get results when complete
curl http://localhost:8000/api/v1/results/JOB_ID | jq > results.json
```

---

**Ready to hack!**
