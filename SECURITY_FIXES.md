# Security Fixes

## Overview

This document summarizes 36 security vulnerability fixes applied across the codebase.

---

## HIGH Severity (16 issues)

### CWE-22 — Path Traversal

#### `backend/app/integrations/nuclei.py` (Ln 41)
- **Fix**: Both `settings.STORAGE_PATH` and `output_file` resolved with `.resolve()` before comparison to prevent symlink-based traversal bypasses

#### `backend/app/pipeline/base_stage.py` (Ln 140, 148, 158, 167, 181)
- **Fix**: All file operations now call `.resolve()` on constructed paths; `write_lines` added path traversal guard

#### `backend/app/tasks/scan_tasks.py` (Ln 336)
- **Fix**: Added `.resolve()` on both the derived path and the base storage path

#### `scripts/fix_live_hosts.py` (Ln 18-20)
- **Fix**: `storage_path` and `storage_base` resolved before `is_relative_to()` check

#### `backend/requirements.txt` — `black==24.1.1`
- **Fix**: Updated `black` to `>=26.3.1` (CVE-2026-32274)

### CWE-79/80 — Cross-Site Scripting (XSS)

#### `frontend/src/hooks/useAuth.ts` (Ln 14-15)
- **Fix**: Replaced `DOMPurify` with regex `[^A-Za-z0-9._-]` stripping; added empty-token guard

#### `frontend/src/services/api.ts` (Ln 66-67)
- **Fix**: Added empty-string check after token sanitization

### CWE-89 — SQL Injection

#### `scripts/delete_all_scans.py` (Ln 22-23)
- **Fix**: Replaced `f-string` interpolation with SQLAlchemy `Table.delete()` using reflected metadata and allowlist validation

### CWE-93 — CRLF Injection

#### `frontend/package.json` (transitive dep — `follow-redirects`)
- **Fix**: Added pnpm override `"follow-redirects": ">=1.15.6"`; updated `axios` to `^1.7.9`

### CWE-117 — Log Injection

#### `frontend/src/App.tsx` (Ln 17)
- **Fix**: Strips `\r\n` from `error.name` before logging

#### `frontend/src/components/common/ErrorBoundary.tsx` (Ln 24)
- **Fix**: Both `error.name` and `componentStack` stripped of `\r\n`; stack truncated to 100 chars

### CWE-400 — Denial of Service

#### `backend/requirements.txt` — `fastapi==0.109.0`
- **Fix**: Updated `fastapi` to `>=0.109.1` (CVE-2024-24762 ReDoS)

### CWE-502/1321 — Deserialization / Prototype Pollution

#### `frontend/src/hooks/useScanWebSocket.ts` (Ln 46)
- **Fix**: Added message size cap (1MB), `Array.isArray` rejection, `typeof type !== 'string'` guard

### CWE-918 — Server-Side Request Forgery (SSRF)

#### `frontend/src/services/api.ts` (Ln 72)
- **Fix**: Added `config?.url?.startsWith('/')` check to ensure only relative URLs are retried

### CWE-937/1035/1333 — ReDoS / Regex

#### `backend/requirements.txt` — `black`
- **Fix**: Updated to `>=26.3.1`

#### `frontend/package.json` (transitive deps — `mime-types`, `mime-db`)
- **Fix**: Added pnpm overrides

---

## MEDIUM Severity (9 issues)

### CWE-400/664 — Resource Leak

#### `backend/app/core/websocket_manager.py` (Ln 84, 104, 115, 133)
- **Issue**: `asyncio.get_event_loop().time()` repeatedly called — in Python 3.10+ can create new event loops, leaking handles. No `shutdown()` method to clean up Redis pubsub/client.
- **Fix**: Replaced with `time.time()`; added `shutdown()` method that cancels the pubsub listener task, unsubscribes, and closes Redis connections

#### `backend/tests/unit/test_security.py` (Ln 67, 70)
- **Issue**: Event loop and Redis client created without a `finally` block — leaks on unhandled exceptions
- **Fix**: Wrapped in `try/finally` — client and loop always closed

### CWE-379/937/1035 — Package Vulnerability

#### `backend/requirements.txt` (Ln 45 — `pytest==7.4.4`)
- **Fix**: Updated `pytest` to `>=8.3.4`

### CWE-73/522 — External Control of File Name / Insufficiently Protected Credentials

#### `frontend/package.json` (dev deps — `eslint`, `@typescript-eslint/*`)
- **Fix**: Updated `eslint` to `^9.0.0`; added pnpm overrides: `@typescript-eslint/eslint-plugin` >=7.0.0, `@typescript-eslint/parser` >=7.0.0

### CWE-346 — Origin Validation Error

#### `frontend/package.json` (transitive dep — `@babel/traverse`)
- **Fix**: Added pnpm override `"@babel/traverse": ">=7.23.2"`

---

---

## LOW Severity (11 issues)

### CWE-703 — Improper Error Handling

#### `backend/app/integrations/gau.py` (Ln 46)
- **Issue**: Bare `except Exception: continue` swallowed all errors including `ValueError` from malformed URLs, masking failures
- **Fix**: Changed to `except ValueError:` with structured warning log; added `_logger` with context

#### `backend/app/pipeline/stages/stage08_js_analysis.py` (Ln 87)
- **Issue**: Bare `except Exception: continue` in JS file analysis loop silently skipped files on any error
- **Fix**: Changed to `except (OSError, UnicodeDecodeError, re.error)` with `await self.warning()` log

### CWE-20/436 — Improper Input Validation / Package Vulnerability

#### `backend/requirements.txt` (Ln 22 — `python-multipart==0.0.6`)
- **Fix**: Updated `python-multipart` to `>=0.0.7`

### High Coupling (Code Quality — Reduces Attack Surface via Complexity)

#### `backend/app/api/routes/data.py` (Ln 107, 185, 261)
- **Issue**: `list_endpoints`, `list_vulnerabilities`, `list_insights` each contained inline dict-building boilerplate for ORM objects and pagination responses, creating high coupling
- **Fix**: Extracted `_subdomain_to_dict`, `_endpoint_to_dict`, `_vulnerability_to_dict`, `_insight_to_dict`, and `_build_paginated_response` helpers; all endpoint handlers now use these single-responsibility functions

#### `backend/app/api/routes/insights.py` (Ln 30)
- **Issue**: `get_job_insights` and 4 other endpoints duplicated the job existence check with inline `select(ScanJob)...` pattern
- **Fix**: Extracted `_get_job_or_404(db, job_id, user_id)` helper; all 5 endpoints now call it instead of repeating the query

#### `backend/app/pipeline/stages/stage07_js_download.py` (Ln 20)
- **Issue**: `execute` method contained all download logic inline including nested async closure with mutable `nonlocal` counters
- **Fix**: Extracted `_download_single_js` class method returning `(downloaded, failed)` tuple; `execute` now aggregates results with `asyncio.gather`

#### `backend/app/services/scan.py` (Ln 80)
- **Issue**: `list_user_scans` manually handled sort and pagination inline with low-level `getattr` and `order_by` calls
- **Fix**: Extracted `_apply_sort` and `_apply_pagination` helper methods reused across the class

### Global Variables

#### `backend/app/core/rate_limit.py` (Ln 13)
- **Issue**: Module-level `_redis_available: Optional[bool]` global could be mutated concurrently from multiple coroutines
- **Fix**: Encapsulated inside `_RedisState` class with instance attribute

#### `backend/app/tasks/scan_tasks.py` (Ln 46)
- **Issue**: Module-level `_worker_loop` global used to cache the asyncio event loop was a mutable shared global
- **Fix**: Encapsulated inside `_WorkerLoopState` class with instance attribute

---

## Files Modified

| File | Severity | CWEs |
|---|---|---|
| `backend/app/integrations/nuclei.py` | HIGH | CWE-22 |
| `backend/app/pipeline/base_stage.py` | HIGH | CWE-22 |
| `backend/app/tasks/scan_tasks.py` | HIGH | CWE-22 |
| `scripts/fix_live_hosts.py` | HIGH | CWE-22 |
| `scripts/delete_all_scans.py` | HIGH | CWE-89 |
| `frontend/src/App.tsx` | HIGH | CWE-117 |
| `frontend/src/components/common/ErrorBoundary.tsx` | HIGH | CWE-117 |
| `frontend/src/hooks/useAuth.ts` | HIGH | CWE-79, 80 |
| `frontend/src/hooks/useScanWebSocket.ts` | HIGH | CWE-502, 1321 |
| `frontend/src/services/api.ts` | HIGH | CWE-79, 80, 918 |
| `backend/app/core/websocket_manager.py` | MEDIUM | CWE-400, 664 |
| `backend/tests/unit/test_security.py` | MEDIUM | CWE-400, 664 |
| `backend/app/core/rate_limit.py` | LOW | Global variable |
| `backend/app/integrations/gau.py` | LOW | CWE-703 |
| `backend/app/pipeline/stages/stage07_js_download.py` | LOW | High coupling |
| `backend/app/pipeline/stages/stage08_js_analysis.py` | LOW | CWE-703 |
| `backend/app/services/scan.py` | LOW | High coupling |
| `backend/app/api/routes/data.py` | LOW | High coupling |
| `backend/app/api/routes/insights.py` | LOW | High coupling |
| `backend/requirements.txt` | HIGH + MEDIUM + LOW | CWE-20, 22, 379, 400, 436, 937, 1035, 1333 |
| `frontend/package.json` | HIGH + MEDIUM | CWE-73, 93, 346, 400, 522, 770, 937, 1035, 1333 |

---

## Post-Fix Steps

1. **Backend**: Run `pip install -r requirements.txt`
2. **Frontend**: Run `pnpm install` inside `frontend/` to regenerate `pnpm-lock.yaml`
3. **Docker**: Rebuild images with `docker compose build --no-cache`
