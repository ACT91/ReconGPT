"""
ReconGPT Python SDK - Simple API Client

Usage:
    from recongpt import ReconGPT
    
    client = ReconGPT("http://localhost:8000")
    job = client.start_scan("example.com", user_id="test-user")
    
    while not job.is_complete():
        print(f"Progress: {job.progress}%")
        time.sleep(5)
    
    results = job.get_results()
"""

import requests
import time
from typing import Optional, Dict, Any

class ReconGPT:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.api_base = f"{self.base_url}/api/v1"
    
    def start_scan(self, domain: str, user_id: str, project_id: Optional[str] = None) -> 'Job':
        """Start a new reconnaissance scan"""
        response = requests.post(
            f"{self.api_base}/scan/start",
            json={
                "target_domain": domain,
                "user_id": user_id,
                "project_id": project_id
            }
        )
        response.raise_for_status()
        data = response.json()
        return Job(self, data["job_id"])
    
    def get_job(self, job_id: str) -> 'Job':
        """Get existing job by ID"""
        return Job(self, job_id)
    
    def create_project(self, name: str, user_id: str, description: Optional[str] = None) -> Dict:
        """Create a new project"""
        response = requests.post(
            f"{self.api_base}/projects",
            json={
                "name": name,
                "user_id": user_id,
                "description": description
            }
        )
        response.raise_for_status()
        return response.json()
    
    def list_projects(self, user_id: str) -> list:
        """List all projects for a user"""
        response = requests.get(f"{self.api_base}/projects", params={"user_id": user_id})
        response.raise_for_status()
        return response.json()


class Job:
    def __init__(self, client: ReconGPT, job_id: str):
        self.client = client
        self.job_id = job_id
        self._status_cache = None
    
    def get_status(self, refresh: bool = True) -> Dict[str, Any]:
        """Get current job status"""
        if refresh or not self._status_cache:
            response = requests.get(f"{self.client.api_base}/scan/{self.job_id}")
            response.raise_for_status()
            self._status_cache = response.json()
        return self._status_cache
    
    def is_complete(self) -> bool:
        """Check if job is completed"""
        status = self.get_status()
        return status["status"] in ["completed", "failed", "cancelled"]
    
    @property
    def progress(self) -> float:
        """Get job progress percentage"""
        return self.get_status()["progress_percent"]
    
    def get_results(self) -> Dict[str, Any]:
        """Get scan results (only when complete)"""
        response = requests.get(f"{self.client.api_base}/results/{self.job_id}")
        response.raise_for_status()
        return response.json()["results"]
