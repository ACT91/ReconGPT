# Security Fixes

## Overview

This document summarizes 16 security vulnerability fixes applied across the codebase. Each fix targets one or more CWEs identified during a security audit.

---

## Fixed Vulnerabilities

### 1. CWE-22 — Path Traversal

#### `backend/app/integrations/nuclei.py` (Ln 41)
- **Issue**: `output_file` path was checked using `is_relative_to()` without resolving symlinks first
- **Fix**: Both `settings.STORAGE_PATH` and `output_file` are resolved with `.resolve()` before comparison to prevent symlink-based traversal bypasses

#### `backend/app/pipeline/base_stage.py` (Ln 140, 148, 158, 167, 181)
- **Issue**: Path traversal checks in `save_json`, `read_file`, `read_json`, `read_jsonl` used unresovled paths; `write_lines` had no check at all
- **Fix**: All file operations now call `.resolve()` on constructed paths before validating with `is_relative_to()`; `write_lines` now has the same path traversal guard

#### `backend/app/tasks/scan_tasks.py` (Ln 336)
- **Issue**: Storage path used `is_relative_to()` without resolving
- **Fix**: Added `.resolve()` on both the derived path and the base storage path

#### `scripts/fix_live_hosts.py` (Ln 18-20)
- **Issue**: Path validation occurred before resolving symlinks
- **Fix**: `storage_path` and `storage_base` are resolved before the `is_relative_to()` check

#### `backend/requirements.txt` (Ln 53 — `black==24.1.1`)
- **Issue**: `black` < 26.3.1 has CVE-2026-32274 allowing arbitrary file writes via cache filename manipulation
- **Fix**: Updated `black` to `>=26.3.1`

---

### 2. CWE-79/80 — Cross-Site Scripting (XSS)

#### `frontend/src/hooks/useAuth.ts` (Ln 14-15)
- **Issue**: Tokens stored in `localStorage` after only DOMPurify sanitization, which is designed for HTML not token strings
- **Fix**: Replaced `DOMPurify.sanitize()` with regex `[^A-Za-z0-9._-]` stripping and added an empty-token guard to reject malformed responses

#### `frontend/src/services/api.ts` (Ln 66-67)
- **Issue**: Tokens were sanitized but an empty/malformed token could still be stored
- **Fix**: Added an empty-string check (`if (!accessToken || !newRefreshToken)`) after sanitization

---

### 3. CWE-89 — SQL Injection

#### `scripts/delete_all_scans.py` (Ln 22-23)
- **Issue**: Table names interpolated into raw SQL via `f'DELETE FROM "{t}"'`, allowing SQL injection if `t` were ever user-controlled
- **Fix**: Replaced string interpolation with SQLAlchemy `Table.delete()` using reflected metadata; table names are validated against a hardcoded allowlist set

---

### 4. CWE-93 — CRLF Injection

#### `frontend/package.json` (transitive dep via axios)
- **Issue**: `follow-redirects` before 1.15.6 is vulnerable to CRLF injection in HTTP redirect handling
- **Fix**: Added pnpm override `"follow-redirects": ">=1.15.6"`; updated `axios` to `^1.7.9`

---

### 5. CWE-117 — Log Injection

#### `frontend/src/App.tsx` (Ln 17)
- **Issue**: `console.error()` logged `error.name` directly, which could contain injected newlines
- **Fix**: Strips `\r\n` from `error.name` before logging

#### `frontend/src/components/common/ErrorBoundary.tsx` (Ln 24)
- **Issue**: `error.name` and `componentStack` were logged without sanitization
- **Fix**: Both values are stripped of `\r\n` before logging; `componentStack` is also truncated to 100 characters

---

### 6. CWE-400 — Denial of Service

#### `backend/requirements.txt` (Ln 2 — `fastapi==0.109.0`)
- **Issue**: FastAPI < 0.109.1 has CVE-2024-24762 (ReDoS via Content-Type header parsing in `python-multipart`)
- **Fix**: Updated `fastapi` to `>=0.109.1`

#### `frontend/package.json` (transitive deps)
- **Issue**: Memory exhaustion potential in various packages
- **Fix**: Updated `axios` to `^1.7.9`; added pnpm overrides for transitive dependencies

---

### 7. CWE-502/1321 — Deserialization of Untrusted Data / Prototype Pollution

#### `frontend/src/hooks/useScanWebSocket.ts` (Ln 46)
- **Issue**: WebSocket message parsed via `JSON.parse()` and cast to `WSMessage` without sufficient validation, potentially allowing prototype pollution or malicious objects
- **Fix**: Added message size cap (1MB), `Array.isArray` rejection, `typeof type !== 'string'` guard, and ensures `type` is non-empty before processing

---

### 8. CWE-918 — Server-Side Request Forgery (SSRF)

#### `frontend/src/services/api.ts` (Ln 72)
- **Issue**: The retry `api.request(config)` could potentially forward a manipulated URL to axios, making requests to external hosts
- **Fix**: Added `config?.url?.startsWith('/')` check to ensure only relative URLs are retried; the refresh endpoint is hardcoded as a string literal

---

### 9. CWE-937/1035/1333 — ReDoS / Regex Vulnerabilities

#### `backend/requirements.txt` (Ln 53 — `black`)
- **Fix**: `black` < 26.3.1 had regex-related issues; updated to `>=26.3.1`

#### `frontend/package.json` (transitive deps — `mime-types`, `mime-db`)
- **Fix**: Added pnpm overrides `"mime-types": ">=2.1.35"` and `"mime-db": ">=1.53.0"` to ensure patched versions

---

## Files Modified

| File | CWEs Fixed |
|---|---|
| `backend/app/integrations/nuclei.py` | CWE-22 |
| `backend/app/pipeline/base_stage.py` | CWE-22 |
| `backend/app/tasks/scan_tasks.py` | CWE-22 |
| `scripts/fix_live_hosts.py` | CWE-22 |
| `scripts/delete_all_scans.py` | CWE-89 |
| `backend/requirements.txt` | CWE-22, 400, 937, 1035, 1333 |
| `frontend/package.json` | CWE-93, 400, 770, 937, 1035, 1333 |
| `frontend/src/App.tsx` | CWE-117 |
| `frontend/src/components/common/ErrorBoundary.tsx` | CWE-117 |
| `frontend/src/hooks/useAuth.ts` | CWE-79, 80 |
| `frontend/src/hooks/useScanWebSocket.ts` | CWE-502, 1321 |
| `frontend/src/services/api.ts` | CWE-79, 80, 918 |

---

## Post-Fix Steps

1. **Backend**: Run `pip install -r requirements.txt` to pick up patched package versions
2. **Frontend**: Run `pnpm install` inside `frontend/` to regenerate `pnpm-lock.yaml` with patched transitive dependencies
3. **Scripts**: `delete_all_scans.py` now requires database connectivity for metadata reflection (it no longer works without a live DB)
