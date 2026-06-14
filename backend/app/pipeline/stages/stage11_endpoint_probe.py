from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage
from app.integrations.httpx import run_httpx_probe


class EndpointProbeStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.ENDPOINT_PROBE

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            input_file = self.output_dir / "full_urls.txt"
            if not input_file.exists():
                return {"success": False, "error": "full_urls.txt not found"}
            
            output_file = self.output_dir / "endpoints_live.txt"
            json_output = self.output_dir / "endpoints_live.json"
            
            urls_count = len(self.read_lines("full_urls.txt"))
            await self.info(f"Probing {urls_count} URLs")
            
            result = await run_httpx_probe(input_file, output_file, json_output)
            
            if not result.get("success"):
                await self.error(f"Endpoint probing failed: {result.get('error', 'Unknown')}")
                return {"success": False, "error": result.get("error")}
            
            live_endpoints = self.read_lines("endpoints_live.txt")
            await self.info(f"Found {len(live_endpoints)} live endpoints")
            
            result_data = {
                "success": True,
                "total_probed": urls_count,
                "live_endpoints": len(live_endpoints),
                "output_file": str(output_file),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}