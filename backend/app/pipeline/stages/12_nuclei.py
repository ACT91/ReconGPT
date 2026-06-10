from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage
from app.integrations.nuclei import run_nuclei

class NucleiScanStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting Nuclei vulnerability scan")
        
        input_file = self.output_dir / "full_urls.txt"
        output_file = self.output_dir / "nuclei_results.json"
        
        result = run_nuclei(input_file, output_file)
        
        if not result["success"]:
            return {"success": False, "error": result.get("error")}
        
        vulns_count = result.get('vulnerabilities_count', 0)
        self.log(f"Nuclei scan completed. Found {vulns_count} vulnerabilities")
        
        return {
            "success": True,
            "vulnerabilities_count": vulns_count,
            "output_file": str(output_file)
        }
