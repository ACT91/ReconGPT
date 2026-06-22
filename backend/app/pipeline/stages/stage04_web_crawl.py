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
            input_file = self.output_dir / "live_hosts.json"
            if not input_file.exists():
                return {"success": False, "error": "live_hosts.json not found"}
            
            # Extract URLs from JSONL format for Katana
            import json
            urls = []
            with open(input_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data = json.loads(line)
                            url = data.get('url')
                            if url:
                                urls.append(url)
                        except json.JSONDecodeError:
                            continue
            
            if not urls:
                await self.warning("No URLs found in live_hosts.json")
                return {"success": True, "urls_count": 0}
            
            # Create plain text URL list for Katana
            katana_input = self.output_dir / "live_urls.txt"
            katana_input.write_text('\n'.join(urls), encoding='utf-8')
            await self.info(f"Prepared {len(urls)} URLs for crawling")
            
            output_dir = self.output_dir / "katana"
            output_dir.mkdir(exist_ok=True)
            
            await self.info("Starting web crawling with Katana")
            result = await run_katana(katana_input, output_dir)
            
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