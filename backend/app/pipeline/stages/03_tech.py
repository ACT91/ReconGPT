from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage

class TechDetectStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting technology detection")
        
        # Technology data is already in live_hosts.json from stage 2
        tech_file = self.output_dir / "live_hosts.json"
        
        if not tech_file.exists():
            return {"success": False, "error": "live_hosts.json not found"}
        
        self.log("Technology detection completed")
        
        return {
            "success": True,
            "output_file": str(tech_file)
        }
