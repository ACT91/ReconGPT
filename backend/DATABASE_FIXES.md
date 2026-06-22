# Database Issues Fix Summary

## Issues Identified

### 1. All Subdomains Showing as "Dead" (False Positives)

**Problem**: 
- Subdomains were being created but the `is_alive` field was never being set to `False` for hosts that weren't live
- Only live hosts were getting `is_alive = True`, while dead hosts remained with the default value
- The UI shows "Dead" for any subdomain where `is_alive` is `False` or `None`

**Root Cause**:
- The `_save_results_to_db` function in `scan_tasks.py` only updated subdomains that appeared in `live_hosts.json` or `live_hosts.txt`
- Subdomains that were discovered but not alive were never explicitly marked as dead
- URL parsing was inconsistent - sometimes the JSON contained `url`, sometimes `host`, sometimes `input`

**Fix Applied**:
1. Parse live hosts from both JSON and TXT files into a `live_hosts_set`
2. Handle all possible field names in JSON: `url`, `host`, `input`
3. Properly extract hostname from URLs using `urlparse`
4. After processing live hosts, iterate through ALL subdomains and set `is_alive = False` and `status = SubdomainStatus.DEAD` for any not in the live set

### 2. Endpoints Not Showing (500 Internal Server Error)

**Problem**:
- API endpoint `/api/v1/data/endpoints` was returning HTTP 500 errors
- Endpoints couldn't be displayed in the UI

**Root Cause**:
- The Endpoint model defines `source` as a `String(20)` column
- When saving endpoints, some code was storing the enum object directly (`EndpointSource.CRAWL`) instead of its string value (`"crawl"`)
- When querying, the API tried to access `.value` on what was already a string
- This caused inconsistent data types in the database

**Fix Applied**:
1. Updated `_save_results_to_db` to always store `.value` of the enum (string) instead of the enum object
2. Updated the `/data/endpoints` route to work with string values directly
3. Removed `.value` accessor in the API response serialization since `source` is already a string

### 3. Endpoint Source Filtering Causing 500 Error

**Problem**:
- When filtering endpoints by source (Reconstructed, Crawl, JS Mining, etc.) the API returned HTTP 500 errors

**Root Cause**:
- The filter code was trying to convert the string to an `EndpointSource` enum and compare with the database
- Database contained mixed values (some strings, some enums)
- The comparison failed when types didn't match

**Fix Applied**:
1. Changed the filter to compare strings directly: `query.where(Endpoint.source == source)`
2. Removed the enum conversion `EndpointSource(source)` from the filter logic
3. This works because the source column now consistently stores string values

## Files Modified

### 1. `backend/app/tasks/scan_tasks.py`
- Fixed `_save_results_to_db` function to:
  - Track all live hosts in a set
  - Handle multiple JSON field names for hostnames
  - Properly parse URLs to extract hostnames
  - Mark all non-live subdomains as dead explicitly
  - Store endpoint source as string values (`.value`)

### 2. `backend/app/api/routes/data.py`
- Fixed `/data/endpoints` endpoint to:
  - Filter by string source values directly
  - Return source as-is (already a string, no `.value` needed)

## Database Fix Script

Created `backend/fix_database_records.py` to update existing records:
- Fixes all subdomain `is_alive` and `status` fields based on stored live_hosts files
- Converts any remaining enum objects in endpoint source fields to strings

## How to Apply the Fix

1. **For new scans**: The code fixes are already applied, new scans will work correctly

2. **For existing data**: Run the fix script:
   ```bash
   cd backend
   python fix_database_records.py
   ```

3. **Restart the backend**: 
   ```bash
   uvicorn app.main:app --reload
   ```

## Verification

After applying fixes:
- ✅ Subdomains should show correct "Live" and "Dead" status
- ✅ Endpoints should load without 500 errors
- ✅ Endpoint source filters (Reconstructed, Crawl, JS Mining, etc.) should work
- ✅ Assets page should display all data correctly

## Prevention

To prevent similar issues in the future:
1. Always store enum values as strings: `enum_field.value`
2. When filtering by enums, compare with string values directly
3. Ensure all discovered entities are explicitly marked with their status (not left as defaults)
4. Handle multiple possible field names when parsing external tool outputs
