from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any
from app.core.logger import logger
import json

class BasePipelineStage(ABC):
    def __init__(self, job_id: str, target: str, storage_path: Path):
        self.job_id = job_id
        self.target = target
        self.storage_path = storage_path
        self.output_dir = storage_path / job_id
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    @abstractmethod
    def execute(self) -> Dict[str, Any]:
        """Execute the pipeline stage. Must return dict with 'success' key."""
        pass
    
    def log(self, message: str):
        logger.info(f"[{self.job_id}] {message}")
    
    def save_json(self, data: Any, filename: str):
        path = self.output_dir / filename
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def read_file(self, filename: str) -> str:
        path = self.output_dir / filename
        if not path.exists():
            return ""
        return path.read_text()
    
    def read_lines(self, filename: str) -> list:
        content = self.read_file(filename)
        return [line.strip() for line in content.split('\n') if line.strip()]
