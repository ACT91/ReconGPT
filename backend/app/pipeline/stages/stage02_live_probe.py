from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage
from app.integrations.httpx import run_httpx_probe


class LiveProbeStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.LIVE_PROBE

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            input_file = self.output_dir / "subdomains.txt"
            if not input_file.exists():
                return await self._handle_missing_input("subdomains.txt")
            
            output_file = self.output_dir / "live_hosts.txt"
            json_output = self.output_dir / "live_hosts.json"
            
            await self.info("Probing subdomains for live hosts")
            result = await run_httpx_probe(input_file, output_file, json_output)
            
            if not result.get("success"):
                await self.error(f"HTTPX probe failed: {result.get('error', 'Unknown error')}")
                return {"success": False, "error": result.get("error")}
            
            live_hosts = self.read_lines("live_hosts.txt")
            
            has_json = json_output.exists()
            if has_json:
                live_data = self.read_json("live_hosts.json") or []
                await self.info(f"Found {len(live_hosts)} live hosts, {len(live_data)} with tech data")
            else:
                await self.info(f"Found {len(live_hosts)} live hosts (no JSON details)")
            
            result_data = {
                "success": True,
                "live_hosts_count": len(live_hosts),
                "has_json": has_json,
                "output_file": str(output_file),
                "json_output": str(json_output) if has_json else None,
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}
    
    async def _handle_missing_input(self, filename: str) -> Dict[str, Any]:
        await self.error(f"Required input file '{filename}' not found")
        return {"success": False, "error": f"Missing input: {filename}"}