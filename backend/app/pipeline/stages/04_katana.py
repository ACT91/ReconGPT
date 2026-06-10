from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage
from app.integrations.katana import run_katana

class KatanaCrawlStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting web crawling with Katana")
        
        input_file = self.output_dir / "live_hosts.txt"
        output_dir = self.output_dir / "katana"
        output_dir.mkdir(exist_ok=True)
        
        result = run_katana(input_file, output_dir)
        
        if not result["success"]:
            return {"success": False, "error": result.get("error")}
        
        self.log(f"Crawling completed. Found {result.get('urls_count', 0)} URLs")
        
        return {
            "success": True,
            "urls_count": result.get('urls_count', 0),
            "output_dir": str(output_dir)
        }
