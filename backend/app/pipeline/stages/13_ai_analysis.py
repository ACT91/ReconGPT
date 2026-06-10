from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage
from app.ai.analyzer import analyze_scan_results
import json

class AIAnalysisStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting AI analysis")
        
        # Gather all artifacts
        artifacts = {
            "subdomains": self.read_lines("subdomains.txt"),
            "live_hosts": self.read_lines("live_hosts.txt"),
            "endpoints": self.read_lines("endpoints_final.txt"),
        }
        
        # Load vulnerability data
        nuclei_path = self.output_dir / "nuclei_results.json"
        if nuclei_path.exists():
            with open(nuclei_path) as f:
                artifacts["vulnerabilities"] = json.load(f)
        
        # Run AI analysis
        analysis = analyze_scan_results(self.target, artifacts)
        
        # Save report
        output_file = self.output_dir / "ai_report.json"
        self.save_json(analysis, "ai_report.json")
        
        self.log("AI analysis completed")
        
        return {
            "success": True,
            "output_file": str(output_file),
            "risk_score": analysis.get("risk_score", 0)
        }
