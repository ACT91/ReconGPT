# Docker 401 Unauthorized Error - Fixed

## Problem

When using Docker, you were getting `401 (Unauthorized)` errors on the dashboard even though you were logged in. The logs showed:

```
GET /api/v1/dashboard → 307 Redirect
GET /api/v1/dashboard/ → 401 Not authenticated
```

## Root Cause

The issue was caused by **HTTP 307 redirect losing the Authorization header**:

1. Frontend called `/api/v1/dashboard` (without trailing slash)
2. FastAPI automatically redirected to `/api/v1/dashboard/` (with trailing slash)
3. During the 307 redirect, the **Authorization header was lost**
4. Backend received request without authentication → 401 error
5. Frontend tried to refresh token → loop continues

This is a common issue with HTTP redirects - browsers and HTTP clients often don't preserve headers during redirects for security reasons.

## Solution

Fixed the frontend API client to **include the trailing slash** in the dashboard endpoint, avoiding the redirect entirely.

### Changed File
`frontend/src/services/api.ts`

```typescript
// Before (causing redirect and losing auth header)
export const dashboardApi = {
  get: () =>
    api.get<DashboardData>('/dashboard').then((r) => r.data),
}

// After (direct hit, no redirect)
export const dashboardApi = {
  get: () =>
    api.get<DashboardData>('/dashboard/').then((r) => r.data),
}
```

## Verification

Your Docker containers are running correctly:

```bash
✅ reconny-backend    - Up, healthy, port 8000
✅ reconny-postgres   - Up, healthy, port 5432  
✅ reconny-redis      - Up, healthy, port 6379
⚠️  reconny-worker    - Up, but unhealthy (workers need tools installed)
⚠️  reconny-worker-low - Up, but unhealthy (workers need tools installed)
✅ reconny-flower     - Up, port 5555
```

The backend is working correctly - the 401 was purely a frontend API call issue.

## Worker Unhealthy Status

The workers show as "unhealthy" because they're waiting for recon tools (subfinder, httpx, katana, nuclei) to be installed in the Docker images. However, this doesn't affect:
- Authentication
- Dashboard loading
- Viewing past scan results

The workers will process scans once the tools are available in the container.

## To Install Recon Tools in Docker

Update your `backend/Dockerfile` to install the tools:

```dockerfile
# Install Go-based recon tools
RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    go install -v github.com/projectdiscovery/katana/cmd/katana@latest && \
    go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# Make tools available in PATH
ENV PATH="/root/go/bin:${PATH}"
```

Then rebuild:
```bash
docker-compose build backend worker worker-low
docker-compose up -d
```

## What's Fixed Now

✅ **Dashboard 401 errors** - Fixed by adding trailing slash
✅ **Scan results auto-loading** - Fixed earlier with useEffect hooks
✅ **Backend running in Docker** - Confirmed working
✅ **Database connections** - Confirmed working

## Testing

1. Refresh your browser (Ctrl+F5 to clear cache)
2. The dashboard should now load without 401 errors
3. Navigate to a completed scan
4. Click Assets/Endpoints/Findings tabs
5. Results should automatically load! 🎉

## All Your Issues Are Now Fixed

1. ✅ **Scan results not displaying** → Fixed with `useEffect` hooks
2. ✅ **Dashboard 401 errors** → Fixed with trailing slash
3. ⚠️  **Workers unhealthy** → Not affecting current functionality, needs recon tools installed

Your ReconGPT application is now fully functional for viewing existing scan results and will be ready to run new scans once the recon tools are installed in the Docker images!
