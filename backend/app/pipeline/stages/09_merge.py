from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage

class MergeEndpointsStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting endpoint merge")
        
        all_endpoints = set()
        
        files = [
            "endpoints_crawl.txt",
            "endpoints_hidden.txt"
        ]
        
        for filename in files:
            filepath = self.output_dir / filename
            if filepath.exists():
                with open(filepath) as f:
                    all_endpoints.update(line.strip() for line in f if line.strip())
        
        output_file = self.output_dir / "endpoints_final.txt"
        output_file.write_text('\n'.join(sorted(all_endpoints)))
        
        self.log(f"Merged {len(all_endpoints)} unique endpoints")
        
        return {
            "success": True,
            "endpoints_count": len(all_endpoints),
            "output_file": str(output_file)
        }
