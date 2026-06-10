# ReconGPT Pipeline

## Overview

The ReconGPT pipeline consists of 13 sequential stages that automate the complete bug bounty reconnaissance workflow.

## Pipeline Stages

### Stage 1: Subfinder (Subdomain Enumeration)
**Tool:** subfinder  
**Input:** Target domain  
**Output:** `subdomains.txt`

Discovers all subdomains associated with the target domain using passive sources.

```bash
subfinder -d example.com -o subdomains.txt
```

---

### Stage 2: Httpx Probe (Live Host Detection)
**Tool:** httpx  
**Input:** `subdomains.txt`  
**Output:** `live_hosts.txt`, `live_hosts.json`

Probes all discovered subdomains to identify live web services.

```bash
httpx -l subdomains.txt -o live_hosts.txt -json -status-code
```

---

### Stage 3: Technology Detection
**Tool:** httpx  
**Input:** `live_hosts.txt`  
**Output:** `tech.json`

Fingerprints technologies, frameworks, and servers running on live hosts.

```bash
httpx -l live_hosts.txt -tech-detect -json -o tech.json
```

---

### Stage 4: Katana Crawl (Web Crawling)
**Tool:** katana  
**Input:** `live_hosts.txt`  
**Output:** `katana/katana_output.txt`

Recursively crawls all live hosts to discover URLs, forms, and JavaScript files.

```bash
katana -list live_hosts.txt -o katana_output.txt -jc -depth 3
```

---

### Stage 5: JavaScript Extraction
**Input:** `katana/katana_output.txt`  
**Output:** `js_files.txt`

Parses crawl results to extract all JavaScript file URLs.

Pattern: `*.js`, `*.jsx`, `*.ts`, `*.tsx`

---

### Stage 6: Endpoint Extraction
**Input:** `katana/katana_output.txt`  
**Output:** `endpoints_crawl.txt`

Extracts API endpoints, paths, and query parameters from crawl data.

---

### Stage 7: JavaScript Download
**Input:** `js_files.txt`  
**Output:** `js/` directory

Downloads all identified JavaScript files for static analysis.

---

### Stage 8: JavaScript Mining (Static Analysis)
**Input:** `js/` directory  
**Output:** `endpoints_hidden.txt`

Analyzes JavaScript code to discover:
- Hidden API endpoints
- Internal URLs
- Authentication endpoints
- Admin panels

Regex patterns:
- `/api/v[0-9]+/[a-zA-Z0-9/_-]+`
- `https?://[a-zA-Z0-9.-]+/[a-zA-Z0-9/_-]+`

---

### Stage 9: Endpoint Merge
**Input:** `endpoints_crawl.txt`, `endpoints_hidden.txt`  
**Output:** `endpoints_final.txt`

Deduplicates and merges all discovered endpoints.

---

### Stage 10: URL Reconstruction
**Input:** `endpoints_final.txt`, `live_hosts.txt`  
**Output:** `full_urls.txt`

Reconstructs complete URLs by combining base URLs with discovered paths.

Example:
- Base: `https://api.example.com`
- Path: `/v1/users`
- Result: `https://api.example.com/v1/users`

---

### Stage 11: Httpx Endpoint Probe
**Tool:** httpx  
**Input:** `full_urls.txt`  
**Output:** `live_endpoints.txt`

Validates all reconstructed URLs to confirm they're accessible.

```bash
httpx -l full_urls.txt -status-code -mc 200,201,301,302,401,403
```

---

### Stage 12: Nuclei Scan (Vulnerability Detection)
**Tool:** nuclei  
**Input:** `live_endpoints.txt`  
**Output:** `nuclei_results.json`

Scans all live endpoints using Nuclei templates to identify vulnerabilities.

```bash
nuclei -l live_endpoints.txt -jsonl -o nuclei_results.json
```

---

### Stage 13: AI Analysis (Intelligence Layer)
**Tool:** OpenAI GPT-4  
**Input:** All pipeline artifacts  
**Output:** `ai_report.json`

AI-powered analysis that provides:
- Attack surface prioritization
- Critical findings summary
- Risk scoring
- Recommended next steps
- Vulnerability assessment

---

## Pipeline Execution

### Sequential Processing
Each stage must complete successfully before the next begins.

### Error Handling
- If a stage fails, the pipeline halts
- Error details are logged to the job
- Failed jobs can be manually retried

### Progress Tracking
```
Stage 1/13 (7%)   → Subfinder
Stage 4/13 (30%)  → Katana Crawl
Stage 13/13 (100%) → AI Analysis Complete
```

---

## Extending the Pipeline

To add a new stage:

1. Create stage file: `backend/app/pipeline/stages/XX_stage_name.py`
2. Inherit from `BasePipelineStage`
3. Implement `execute()` method
4. Add to `PipelineStage` enum in `models/job.py`
5. Update `STAGE_MAP` in `tasks/scan_tasks.py`

Example:

```python
from app.pipeline.base_stage import BasePipelineStage

class CustomStage(BasePipelineStage):
    def execute(self):
        self.log("Starting custom stage")
        # Your logic here
        return {"success": True}
```

---

## Performance Tuning

- **Timeouts**: Each tool has configurable timeout
- **Concurrency**: Workers can run multiple jobs in parallel
- **Rate Limiting**: Built-in to avoid target overload
- **Caching**: Redis used for intermediate results
