from pathlib import Path
from typing import Dict, Any, List
import json
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage
from app.ai.analyzer import analyze_scan_results
from app.ai.service import generate_insights_from_results


class AiAnalysisStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.AI_ANALYSIS

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            artifacts = {
                "subdomains": self.read_lines("subdomains.txt"),
                "live_hosts": self.read_lines("live_hosts.txt"),
                "endpoints": self.read_lines("endpoints_merged.txt"),
                "full_urls": self.read_lines("full_urls.txt"),
                "technologies": {},
                "vulnerabilities": [],
                "secrets": [],
            }
            
            tech_path = self.output_dir / "technologies.json"
            if tech_path.exists():
                with open(tech_path) as f:
                    artifacts["technologies"] = json.load(f)
            
            nuclei_path = self.output_dir / "nuclei_results.json"
            if nuclei_path.exists():
                vulns = []
                with open(nuclei_path) as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                vulns.append(json.loads(line))
                            except json.JSONDecodeError:
                                continue
                artifacts["vulnerabilities"] = vulns
            
            secrets_path = self.output_dir / "js_secrets.json"
            if secrets_path.exists():
                with open(secrets_path) as f:
                    artifacts["secrets"] = json.load(f)
            
            await self.info("Running AI analysis on scan results")
            analysis = await analyze_scan_results(self.target, artifacts)
            
            report_path = self.save_json(analysis, "ai_report.json")
            
            insights = await generate_insights_from_results(self.target, analysis, artifacts)
            insights_path = self.save_json(insights, "ai_insights.json")
            
            risk_score = analysis.get("risk_score", 0)
            await self.info(f"AI analysis completed. Risk score: {risk_score}/100")
            
            result_data = {
                "success": True,
                "report_file": str(report_path),
                "insights_file": str(insights_path),
                "risk_score": risk_score,
                "insights_count": len(insights),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}