# How to Start the ReconGPT Backend

## Current Issue

You're getting `401 (Unauthorized)` errors because the backend FastAPI server is **not running**. The frontend Vite dev server is running on port 3000 and trying to proxy API requests to port 8000, but nothing is listening there.

## Solution: Start the Backend Server

### Option 1: Quick Start (Recommended)

Open a **new terminal** and run:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

This will start the FastAPI backend server on `http://localhost:8000`.

### Option 2: With Virtual Environment (Recommended for Production)

```bash
cd backend

# Create virtual environment (first time only)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Option 3: Using Docker

If you prefer Docker:

```bash
docker-compose up -d
```

This starts all services (PostgreSQL, Redis, backend, workers).

## Required Services

For the backend to work properly, you also need:

### 1. PostgreSQL Database
```bash
# Check if PostgreSQL is running
# The .env file expects: postgresql://reconny:reconny123@localhost:5432/reconny

# If using Docker:
docker-compose up -d postgres
```

### 2. Redis (for Celery and WebSocket)
```bash
# Check if Redis is running on port 6379

# If using Docker:
docker-compose up -d redis
```

### 3. Celery Worker (for background scan tasks)
Open another terminal:
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

Note: Use `--pool=solo` on Windows as eventlet/gevent may have issues.

## Verification

Once the backend is running, you should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

Then refresh your frontend and the 401 errors should be gone!

## Full Startup Sequence

For complete functionality:

**Terminal 1 - Infrastructure**
```bash
docker-compose up -d postgres redis
```

**Terminal 2 - Backend API**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 3 - Celery Worker**
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

**Terminal 4 - Frontend (already running)**
```bash
cd frontend
npm run dev
```

## Troubleshooting

### Port Already in Use
If port 8000 is already in use:
```bash
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill the process or use a different port:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Then update `frontend/vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8001',  // Change to 8001
    changeOrigin: true,
    ws: true,
  },
}
```

### Database Connection Error
Ensure PostgreSQL is running and the connection string in `.env` is correct:
```
DATABASE_URL=postgresql://reconny:reconny123@localhost:5432/reconny
```

### Redis Connection Error
Ensure Redis is running on port 6379:
```bash
redis-cli ping
# Should return: PONG
```

## Environment Variables

Make sure your `.env` file in the `backend` directory has:
```
DATABASE_URL=postgresql://reconny:reconny123@localhost:5432/reconny
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
SECRET_KEY=dev-secret-key-replace-in-production
OPENAI_API_KEY=your-api-key-here
```

## Next Steps

After starting the backend:
1. The dashboard should load without 401 errors
2. You can create new scans
3. The scan results we fixed earlier will display automatically when you click on Assets/Endpoints/Findings tabs!
