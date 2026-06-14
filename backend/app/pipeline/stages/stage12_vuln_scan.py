from pathlib import Path
from typing import Dict, Any, List
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage
from app.integrations.nuclei import run_nuclei


class VulnScanStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.VULN_SCAN

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            input_file = self.output_dir / "full_urls.txt"
            if not input_file.exists():
                input_file = self.output_dir / "endpoints_live.txt"
            
            if not input_file.exists():
                return {"success": False, "error": "No input file found for vulnerability scanning"}
            
            output_file = self.output_dir / "nuclei_results.json"
            
            await self.info("Starting Nuclei vulnerability scan")
            result = await run_nuclei(input_file, output_file)
            
            vulnerabilities = []
            if output_file.exists():
                with open(output_file, encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                import json
                                vulnerabilities.append(json.loads(line))
                            except json.JSONDecodeError:
                                continue
            
            await self.info(f"Nuclei scan completed. Found {len(vulnerabilities)} vulnerabilities")
            
            severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
            for vuln in vulnerabilities:
                sev = (vuln.get("info", {}) or {}).get("severity", "info").lower()
                if sev in severity_counts:
                    severity_counts[sev] += 1
            
            result_data = {
                "success": True,
                "vulnerabilities_count": len(vulnerabilities),
                "severity_counts": severity_counts,
                "output_file": str(output_file),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}