from pathlib import Path
from typing import Dict, Any
from urllib.parse import urlparse
from app.pipeline.base_stage import BasePipelineStage

class EndpointExtractStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting endpoint extraction")
        
        katana_output = self.output_dir / "katana" / "katana_output.txt"
        if not katana_output.exists():
            return {"success": False, "error": "Katana output not found"}
        
        endpoints = set()
        
        with open(katana_output) as f:
            for line in f:
                line = line.strip()
                if not line or line.endswith(('.js', '.css', '.jpg', '.png', '.gif')):
                    continue
                
                parsed = urlparse(line)
                if parsed.path and parsed.path != '/':
                    endpoints.add(line)
        
        output_file = self.output_dir / "endpoints_crawl.txt"
        output_file.write_text('\n'.join(sorted(endpoints)))
        
        self.log(f"Extracted {len(endpoints)} endpoints from crawl")
        
        return {
            "success": True,
            "endpoints_count": len(endpoints),
            "output_file": str(output_file)
        }
