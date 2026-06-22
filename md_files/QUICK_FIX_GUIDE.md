# Quick Fix Guide

## Problem Summary
1. ❌ All subdomains showing as "Dead" (false positives)
2. ❌ Endpoints page showing 500 errors
3. ❌ Endpoint source filters causing 500 errors

## Solution

### Step 1: Apply Code Fixes (Already Done)
The following files have been updated:
- ✅ `backend/app/tasks/scan_tasks.py` - Fixed subdomain status and endpoint source storage
- ✅ `backend/app/api/routes/data.py` - Fixed endpoint source filtering
- ✅ `backend/fix_database_records.py` - Script to fix existing data

### Step 2: Fix Existing Database Records

Open a terminal in the backend directory and run:

```bash
cd backend
python fix_database_records.py
```

This will:
- Update all subdomain records with correct `is_alive` and `status` values
- Convert endpoint source values to proper string format

### Step 3: Restart Backend

```bash
# If running with uvicorn directly:
uvicorn app.main:app --reload

# If running with docker-compose:
docker-compose restart backend
```

### Step 4: Restart Celery Worker

```bash
# In a separate terminal:
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

### Step 5: Verify Fixes

1. **Check Subdomains**: 
   - Navigate to the Assets page
   - Filter by "Live" and "Dead" 
   - Verify correct counts

2. **Check Endpoints**:
   - Navigate to the Endpoints page
   - Verify endpoints load without errors
   - Test source filters (Reconstructed, Crawl, JS Mining, etc.)

3. **Run a Test Scan**:
   - Create a new scan for a domain
   - Verify results show correct live/dead status

## Expected Results After Fix

✅ Subdomains show accurate "Live" and "Dead" status
✅ Endpoints page loads successfully
✅ All endpoint source filters work correctly
✅ No more 500 errors

## Rollback (If Needed)

If you need to rollback:
```bash
git checkout backend/app/tasks/scan_tasks.py
git checkout backend/app/api/routes/data.py
```

Then restart the backend and worker.
