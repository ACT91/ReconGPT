# ReconGPT Architecture

## System Overview

ReconGPT is a distributed reconnaissance automation platform built on a job-based pipeline architecture.

## Core Components

### 1. API Layer (FastAPI)
- RESTful endpoints for scan management
- Job orchestration and status tracking
- Authentication and authorization
- Rate limiting and validation

### 2. Database Layer (PostgreSQL)
**Entities:**
- Users: Authentication and ownership
- Projects: Organizational grouping
- Jobs: Scan execution tracking
- Assets: Discovered subdomains/hosts
- Endpoints: URLs and API paths
- JSFiles: JavaScript tracking
- Vulnerabilities: Security findings

### 3. Queue System (Redis + Celery)
- Job queue management
- Distributed task execution
- Pipeline stage orchestration
- Result tracking

### 4. Worker Pool
- Stateless execution units
- Horizontal scaling support
- Tool integration layer
- Error handling and retry logic

### 5. Pipeline Engine
**13 Sequential Stages:**
1. Subfinder - Subdomain enumeration
2. Httpx - Live host probing
3. Tech Detection - Technology fingerprinting
4. Katana - Web crawling
5. JS Extraction - Identify JavaScript files
6. Endpoint Extraction - Parse crawl results
7. JS Download - Fetch JavaScript files
8. JS Mining - Static analysis for hidden endpoints
9. Merge - Deduplicate and aggregate endpoints
10. URL Build - Reconstruct full URLs
11. Httpx Endpoint - Probe all endpoints
12. Nuclei - Vulnerability scanning
13. AI Analysis - Intelligent prioritization

### 6. AI Layer
- GPT-4 powered analysis
- Attack surface prioritization
- Risk scoring
- Actionable recommendations

### 7. Storage Layer
**File System:**
```
storage/jobs/{job_id}/
├── subdomains.txt
├── live_hosts.txt
├── live_hosts.json
├── katana/
├── js/
├── endpoints_final.txt
├── full_urls.txt
├── nuclei_results.json
└── ai_report.json
```

## Data Flow

```
User Request
    ↓
API (FastAPI)
    ↓
Create Job → PostgreSQL
    ↓
Queue Task → Redis
    ↓
Worker Pool (Celery)
    ↓
Pipeline Stages (Sequential)
    ↓
Store Results → PostgreSQL + File System
    ↓
AI Analysis → OpenAI
    ↓
Return Results → User
```

## Scaling Strategy

### Horizontal Scaling
- Add more Celery workers
- Use Redis Sentinel for HA
- PostgreSQL read replicas
- Load balancer for API

### Vertical Scaling
- Increase worker concurrency
- Larger database instance
- Redis clustering

## Security Architecture

1. **Input Validation**: All domains validated before scanning
2. **Isolation**: Each job runs in isolated context
3. **Rate Limiting**: Per-user scan limits
4. **Audit Logging**: Full scan history
5. **Secret Management**: Environment-based configuration

## Technology Stack

- **Backend**: Python 3.11 + FastAPI
- **Database**: PostgreSQL 15
- **Queue**: Redis 7 + Celery 5
- **AI**: OpenAI GPT-4
- **Tools**: subfinder, httpx, katana, nuclei
- **Container**: Docker + Docker Compose
- **Orchestration**: Kubernetes (production)

## Deployment Modes

### Development
```bash
docker-compose up
```

### Production
- Kubernetes cluster
- Managed PostgreSQL (RDS)
- Managed Redis (ElastiCache)
- Container registry
- Load balancer (ALB/NLB)

## Monitoring

- Application logs → CloudWatch / ELK
- Metrics → Prometheus + Grafana
- Health checks → /health endpoint
- Job status tracking → Database queries
