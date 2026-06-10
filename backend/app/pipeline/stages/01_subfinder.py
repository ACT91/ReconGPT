from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage
from app.integrations.subfinder import run_subfinder

class SubfinderStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log(f"Starting subdomain enumeration for {self.target}")
        
        output_file = self.output_dir / "subdomains.txt"
        result = run_subfinder(self.target, output_file)
        
        if not result["success"]:
            return {"success": False, "error": result.get("error")}
        
        subdomains = self.read_lines("subdomains.txt")
        self.log(f"Found {len(subdomains)} subdomains")
        
        return {
            "success": True,
            "subdomains_count": len(subdomains),
            "output_file": str(output_file)
        }
