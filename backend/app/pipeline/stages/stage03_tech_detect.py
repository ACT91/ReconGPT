from typing import Dict, Any
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage


class TechDetectStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.TECH_DETECT

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            live_hosts_json = self.output_dir / "live_hosts.json"
            if not live_hosts_json.exists():
                await self.warning("No live hosts JSON found — no live hosts were detected, skipping tech detection")
                result_data = {
                    "success": True,
                    "technologies_count": 0,
                    "skipped": True,
                    "message": "No live hosts to detect technologies from",
                }
                await self.mark_completed(result_data)
                return result_data
            
            live_data = self.read_json("live_hosts.json") or []
            
            technologies_found = {}
            for host in live_data:
                if isinstance(host, dict):
                    techs = host.get("technologies", []) or host.get("tech", [])
                    for tech in techs:
                        tech_name = tech if isinstance(tech, str) else tech.get("name", str(tech))
                        if tech_name not in technologies_found:
                            technologies_found[tech_name] = []
                        host_url = host.get("url", host.get("host", "unknown"))
                        technologies_found[tech_name].append(host_url)
            
            if technologies_found:
                self.save_json(technologies_found, "technologies.json")
                await self.info(f"Detected {len(technologies_found)} unique technologies")
            else:
                await self.info("No technologies detected from live hosts JSON")
            
            result_data = {
                "success": True,
                "technologies_count": len(technologies_found),
                "output_file": str(self.output_dir / "technologies.json"),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}
    
    async def _handle_missing(self, filename: str) -> Dict[str, Any]:
        await self.error(f"Required file '{filename}' not found")
        return {"success": False, "error": f"Missing: {filename}"}