from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage
from app.integrations.httpx import run_httpx_endpoint_probe

class HttpxEndpointStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting endpoint probing")
        
        input_file = self.output_dir / "full_urls.txt"
        output_file = self.output_dir / "live_endpoints.txt"
        
        result = run_httpx_endpoint_probe(input_file, output_file)
        
        if not result["success"]:
            return {"success": False, "error": result.get("error")}
        
        live_endpoints = self.read_lines("live_endpoints.txt")
        self.log(f"Found {len(live_endpoints)} live endpoints")
        
        return {
            "success": True,
            "live_endpoints_count": len(live_endpoints),
            "output_file": str(output_file)
        }
