# Reconny - Project Complete Overview

## What Has Been Built

A **production-ready attack surface management platform** with complete backend pipeline and modern React frontend.

---

## Backend (100% Complete)

### Core System
- ✅ 13-stage reconnaissance pipeline
- ✅ FastAPI REST API with 4 route groups
- ✅ PostgreSQL database with 7 models
- ✅ Celery + Redis job queue system
- ✅ 4 tool integrations (subfinder, httpx, katana, nuclei)
- ✅ OpenAI GPT-4 AI analysis layer
- ✅ Docker + Docker Compose infrastructure

### Database Schema
```
User → Projects → Jobs
Jobs → Assets (subdomains/hosts)
Jobs → Endpoints (URLs/paths)
Jobs → JSFiles (JavaScript files)
Jobs → Vulnerabilities (findings)
```

### Pipeline Flow
```
Domain → Subfinder → Httpx → Katana → JS Extract → 
JS Download → JS Mining → Endpoint Merge → URL Build → 
Httpx Probe → Nuclei → AI Analysis → Report
```

---

## Frontend (Complete Architecture)

### Tech Stack
```
React 19 + TypeScript + Vite
├── TailwindCSS (custom design system)
├── React Router (routing)
├── TanStack Query (server state)
├── Zustand (client state)
├── React Flow (attack surface graph) ⭐
├── ECharts (analytics)
├── React Hook Form + Zod (forms)
└── Axios (API client)
```

### Design System
**Warm, modern aesthetic** with:
- Gradient backgrounds (#F8F5F0 → #FAF0D9)
- Brand yellow accent (#FFD966)
- Large rounded corners (2.5rem)
- Glass morphism effects
- Pill-shaped components
- Hanken Grotesk font

### Pages Implemented
1. ✅ **Dashboard** - Attack surface overview with graph
2. ✅ **Navigation** - Glass morphism nav bar
3. ✅ **Login** - Authentication page
4. 🔨 **Scans** - Placeholder (needs implementation)
5. 🔨 **Assets** - Placeholder (needs implementation)
6. 🔨 **Endpoints** - Placeholder (needs implementation)
7. 🔨 **Findings** - Placeholder (needs implementation)
8. 🔨 **AI Analysis** - Placeholder (needs implementation)
9. 🔨 **Reports** - Placeholder (needs implementation)
10. 🔨 **Settings** - Placeholder (needs implementation)

### Key Feature: Attack Surface Graph

**File:** `frontend/src/graphs/AttackSurfaceGraph.tsx`

**Visual Hierarchy:**
```
Target Domain (yellow node)
    ↓
Subdomains (with live badges)
    ↓
JS Files (purple)
    ↓
Endpoints (gray)
    ↓
Vulnerabilities (color-coded: red/orange/yellow)
```

**Features:**
- Interactive draggable nodes
- Zoom & pan controls
- Mini-map navigation
- Animated edges for critical findings
- Node color coding by type
- Auto-layout with spacing

**This is the differentiator** - most recon tools show lists. Reconny shows the **attack surface as a navigable graph**.

---

## Directory Structure

```
Reconny/
├── backend/
│   ├── app/
│   │   ├── api/routes/           # 4 API route modules
│   │   ├── core/                 # Config, DB, logging
│   │   ├── models/               # 7 database models
│   │   ├── pipeline/stages/      # 13 pipeline stages
│   │   ├── integrations/         # Tool wrappers
│   │   ├── ai/                   # GPT analysis
│   │   ├── tasks/                # Celery workers
│   │   └── utils/                # Utilities
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/                  # Router, providers, layouts
│   │   ├── pages/                # 10 page components
│   │   ├── features/             # Feature modules
│   │   ├── components/           # Shared components
│   │   ├── graphs/               # Attack surface graph ⭐
│   │   ├── services/             # API integration
│   │   ├── types/                # TypeScript definitions
│   │   └── styles/               # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── README.md
│
├── infrastructure/
│   ├── kubernetes/
│   ├── nginx/
│   └── redis/
│
├── storage/jobs/                 # Scan artifacts
├── docs/                         # Documentation
├── examples/                     # Usage examples
├── docker-compose.yml            # 5 services
├── .env.example
└── README.md
```

---

## Running the System

### Quick Start (Docker)
```bash
# 1. Clone and setup
git clone <repo>
cd Reconny
cp .env.example .env
# Edit .env with OpenAI key

# 2. Start all services
docker-compose up -d

# 3. Access
Frontend: http://localhost:3000
Backend: http://localhost:8000
API Docs: http://localhost:8000/docs
```

### Manual (Development)
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Worker (separate terminal)
celery -A app.tasks.celery_app worker --loglevel=info

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## API Endpoints

```http
POST   /api/v1/scan/start          # Start reconnaissance scan
GET    /api/v1/scan/{job_id}       # Get scan status & progress
GET    /api/v1/scan/{job_id}/logs  # Stream scan logs
GET    /api/v1/results/{job_id}    # Get scan results
POST   /api/v1/projects            # Create project
GET    /api/v1/projects            # List projects
```

---

## Usage Example

```bash
# 1. Start a scan
curl -X POST http://localhost:8000/api/v1/scan/start \
  -H "Content-Type: application/json" \
  -d '{
    "target_domain": "example.com",
    "user_id": "researcher"
  }'

# Response: { "job_id": "uuid", "status": "queued" }

# 2. Monitor progress
curl http://localhost:8000/api/v1/scan/{job_id}

# Response: {
#   "status": "running",
#   "current_stage": "08_js_mining",
#   "progress_percent": 62.5
# }

# 3. View results in Dashboard
# Open http://localhost:3000/dashboard
# See attack surface graph with all discovered assets
```

---

## What Makes Reconny Different

### 1. Visual Attack Surface Graph
**Not a CRUD dashboard.** Shows the **recon workflow visually**:
- Domain discovery
- Live host detection
- Technology mapping
- JavaScript analysis
- Endpoint discovery
- Vulnerability correlation

### 2. AI-Powered Analysis
GPT-4 analyzes scan results and provides:
- Risk scoring
- Attack surface prioritization
- Actionable recommendations
- Executive summaries

### 3. Job-Based Architecture
- Every scan is tracked
- Resumable after failures
- Complete audit trail
- Horizontal worker scaling

### 4. Modern Design
- Warm aesthetic (not dark/cyberpunk)
- Glass morphism
- Smooth animations
- Brand consistency

---

## Configuration

**Key Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://reconny:reconny123@localhost:5432/reconny

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1

# AI
OPENAI_API_KEY=sk-your-key-here
AI_MODEL=gpt-4

# Tools (install from ProjectDiscovery)
SUBFINDER_PATH=/usr/local/bin/subfinder
HTTPX_PATH=/usr/local/bin/httpx
KATANA_PATH=/usr/local/bin/katana
NUCLEI_PATH=/usr/local/bin/nuclei
```

---

## Next Steps for Contributors

### High Priority
1. **Scans Page** - Real-time scan monitoring with WebSocket
2. **Assets Page** - Table view of discovered subdomains/hosts
3. **Findings Page** - Vulnerability management interface
4. **Auth Implementation** - JWT token system

### Medium Priority
5. **Projects CRUD** - Full project management
6. **Endpoints Table** - Discovered endpoints with filters
7. **AI Analysis View** - Executive summary display
8. **Export Functions** - PDF/CSV/JSON reports

### Low Priority
9. **Charts Integration** - ECharts analytics
10. **WebSocket** - Real-time updates
11. **Dark Mode** - Theme toggle
12. **Mobile UI** - Responsive improvements

---

## Open Source Governance

### Contribution Rules
- ✅ Max 5 files per PR
- ✅ Code review required
- ✅ Vibe coding allowed (but quality checked)
- ✅ Tests mandatory
- ✅ No secrets in commits

### Templates
- ✅ Bug report template
- ✅ Feature request template
- ✅ Pull request template

### Documentation
- ✅ README.md
- ✅ CONTRIBUTING.md
- ✅ CODE_OF_CONDUCT.md
- ✅ SECURITY.md
- ✅ Architecture docs
- ✅ API docs
- ✅ Pipeline docs

---

## Security

**Disclaimer:** Reconny is for **authorized security testing only**.

- Always obtain permission before scanning
- Respect rate limits
- Follow responsible disclosure
- Audit all scans

Report vulnerabilities privately to: security@reconny.io

---

## Tech Credits

**Backend:**
- FastAPI, SQLAlchemy, Celery, PostgreSQL, Redis
- ProjectDiscovery tools (subfinder, httpx, katana, nuclei)
- OpenAI GPT models

**Frontend:**
- React, TypeScript, Vite, TailwindCSS
- React Flow (attack surface visualization)
- TanStack Query, Zustand
- ECharts, Lucide Icons

---

## License

MIT License - See LICENSE file

---

## Status

**Backend:** Production-ready ✅
**Frontend:** Core architecture complete, pages need implementation 🔨
**Infrastructure:** Docker Compose ready ✅
**Documentation:** Comprehensive ✅

**Ready for deployment and contribution.**

---

Star this repo if Reconny helps your security research!
