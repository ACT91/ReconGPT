from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
import json

from app.core.database import get_db
from app.core.config import settings
from app.models.job import Job

router = APIRouter()

@router.get("/{job_id}")
def get_results(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    results_dir = Path(settings.STORAGE_PATH) / job_id
    
    if not results_dir.exists():
        return {"job_id": job_id, "results": {}}
    
    results = {}
    
    # Load text files
    for file in ["subdomains.txt", "live_hosts.txt", "endpoints_final.txt"]:
        path = results_dir / file
        if path.exists():
            results[file] = path.read_text().split('\n')
    
    # Load JSON files
    for file in ["nuclei_results.json", "ai_report.json"]:
        path = results_dir / file
        if path.exists():
            with open(path) as f:
                results[file] = json.load(f)
    
    return {"job_id": job_id, "results": results}
