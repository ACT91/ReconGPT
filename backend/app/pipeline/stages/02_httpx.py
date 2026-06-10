from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage
from app.integrations.httpx import run_httpx_probe

class HttpxProbeStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting live host probing")
        
        input_file = self.output_dir / "subdomains.txt"
        output_file = self.output_dir / "live_hosts.txt"
        json_output = self.output_dir / "live_hosts.json"
        
        result = run_httpx_probe(input_file, output_file, json_output)
        
        if not result["success"]:
            return {"success": False, "error": result.get("error")}
        
        live_hosts = self.read_lines("live_hosts.txt")
        self.log(f"Found {len(live_hosts)} live hosts")
        
        return {
            "success": True,
            "live_hosts_count": len(live_hosts),
            "output_file": str(output_file)
        }
