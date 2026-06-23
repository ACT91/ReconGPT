from pathlib import Path
from typing import Dict, Any, Set
from urllib.parse import urlparse
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage


STATIC_EXTENSIONS = {'.js', '.css', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico',
                     '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.gz',
                     '.mp4', '.mp3', '.webm', '.webp'}


class EndpointExtractStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.ENDPOINT_EXTRACT

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            katana_output = self.output_dir / "katana" / "katana_output.txt"
            if not katana_output.exists():
                await self.warning("Katana output not found, creating empty endpoint file")
                output_file = self.output_dir / "endpoints_crawl.txt"
                output_file.write_text('', encoding='utf-8')
                return {"success": True, "endpoints_count": 0}
            
            endpoints: Set[str] = set()
            
            with open(katana_output, encoding='utf-8', errors='ignore') as f:
                for line in f:
                    url = line.strip()
                    if not url:
                        continue
                    
                    lower_url = url.lower()
                    if any(lower_url.endswith(ext) for ext in STATIC_EXTENSIONS):
                        continue
                    
                    parsed = urlparse(url)
                    path = parsed.path or '/'
                    
                    if path != '/' or parsed.query:
                        endpoints.add(url)
            
            ep_list = sorted(endpoints)
            output_file = self.output_dir / "endpoints_crawl.txt"
            output_file.write_text('\n'.join(ep_list), encoding='utf-8')
            
            if not endpoints:
                await self.warning("No endpoints extracted from crawl (file empty or only static resources)")
            else:
                await self.info(f"Extracted {len(endpoints)} unique endpoints from crawl")
            
            result_data = {
                "success": True,
                "endpoints_count": len(endpoints),
                "output_file": str(output_file),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}