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

    def _build_artifacts(self) -> Dict[str, Any]:
        artifacts = {
            "subdomains": self.read_lines("subdomains.txt"),
            "live_hosts": [],
            "endpoints": self.read_lines("endpoints_merged.txt"),
            "full_urls": self.read_lines("full_urls.txt"),
            "technologies": {},
            "vulnerabilities": [],
            "secrets": [],
        }
        
        live_hosts_path = self.output_dir / "live_hosts.json"
        if live_hosts_path.exists():
            with open(live_hosts_path) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data = json.loads(line)
                            url = data.get('url')
                            if url:
                                artifacts["live_hosts"].append(url)
                        except json.JSONDecodeError:
                            continue
        
        tech_path = self.output_dir / "technologies.json"
        if tech_path.exists():
            with open(tech_path) as f:
                artifacts["technologies"] = json.load(f)
        
        nuclei_path = self.output_dir / "nuclei_results.json"
        if nuclei_path.exists():
            with open(nuclei_path) as f:
                artifacts["vulnerabilities"] = [
                    json.loads(l) for l in f
                    if (s := l.strip()) and not s.startswith('#')
                ]
        
        secrets_path = self.output_dir / "js_secrets.json"
        if secrets_path.exists():
            with open(secrets_path) as f:
                artifacts["secrets"] = json.load(f)
        
        return artifacts

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            artifacts = self._build_artifacts()
            
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