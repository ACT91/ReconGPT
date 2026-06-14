from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage
from app.integrations.katana import run_katana


class WebCrawlStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.WEB_CRAWL

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            input_file = self.output_dir / "live_hosts.txt"
            if not input_file.exists():
                return {"success": False, "error": "live_hosts.txt not found"}
            
            output_dir = self.output_dir / "katana"
            output_dir.mkdir(exist_ok=True)
            
            await self.info("Starting web crawling with Katana")
            result = await run_katana(input_file, output_dir)
            
            if not result.get("success"):
                await self.warning(f"Katana crawl had issues: {result.get('error', 'Unknown')}")
            
            urls_count = result.get("urls_count", 0)
            await self.info(f"Crawl completed. Found {urls_count} URLs")
            
            result_data = {
                "success": True,
                "urls_count": urls_count,
                "output_dir": str(output_dir),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}