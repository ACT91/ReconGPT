# ReconGPT API Documentation

Base URL: `http://localhost:8000/api/v1`

## Authentication

Currently authentication is not implemented. Use `user_id` in requests.

---

## Endpoints

### Scan Management

#### Start New Scan
```http
POST /scan/start
```

**Request Body:**
```json
{
  "target_domain": "example.com",
  "user_id": "user123",
  "project_id": "project-uuid" // optional
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Scan queued for example.com"
}
```

---

#### Get Scan Status
```http
GET /scan/{job_id}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "target_domain": "example.com",
  "status": "running",
  "current_stage": "04_katana_crawl",
  "progress_percent": 45.5,
  "created_at": "2024-01-01T10:00:00Z",
  "started_at": "2024-01-01T10:00:05Z",
  "completed_at": null,
  "error_message": null
}
```

**Status Values:**
- `queued`: Job is waiting in queue
- `running`: Job is currently executing
- `completed`: Job finished successfully
- `failed`: Job encountered an error
- `cancelled`: Job was manually cancelled

---

#### Get Scan Logs
```http
GET /scan/{job_id}/logs
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "logs": "2024-01-01 10:00:05 - Starting subfinder...\n2024-01-01 10:01:12 - Found 45 subdomains\n..."
}
```

---

### Results

#### Get Scan Results
```http
GET /results/{job_id}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "results": {
    "subdomains.txt": ["sub1.example.com", "sub2.example.com"],
    "live_hosts.txt": ["https://sub1.example.com", "https://sub2.example.com"],
    "endpoints_final.txt": ["/api/v1/users", "/admin/login"],
    "nuclei_results.json": [...],
    "ai_report.json": {
      "target": "example.com",
      "risk_score": 45.5,
      "analysis": "...",
      "recommendations": [...]
    }
  }
}
```

---

### Projects

#### Create Project
```http
POST /projects
```

**Request Body:**
```json
{
  "user_id": "user123",
  "name": "Acme Corp Bug Bounty",
  "description": "Security testing for Acme Corp"
}
```

**Response:**
```json
{
  "id": "project-uuid",
  "name": "Acme Corp Bug Bounty",
  "description": "Security testing for Acme Corp",
  "created_at": "2024-01-01T10:00:00Z"
}
```

---

#### List Projects
```http
GET /projects?user_id=user123
```

**Response:**
```json
[
  {
    "id": "project-uuid-1",
    "name": "Acme Corp Bug Bounty",
    "description": "Security testing for Acme Corp",
    "created_at": "2024-01-01T10:00:00Z"
  },
  {
    "id": "project-uuid-2",
    "name": "Example Inc",
    "description": null,
    "created_at": "2024-01-02T14:30:00Z"
  }
]
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message here"
}
```

**Status Codes:**
- `400`: Bad Request - Invalid input
- `404`: Not Found - Resource doesn't exist
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error

---

## Rate Limiting

- 10 scans per user per hour
- 3 concurrent scans per user

---

## Interactive Documentation

FastAPI provides automatic interactive documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
