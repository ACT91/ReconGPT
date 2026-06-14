from pathlib import Path
from typing import Dict, Any, List
import asyncio
import httpx
import hashlib
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage


MAX_JS_FILES = 100
CONCURRENT_DOWNLOADS = 10
DOWNLOAD_TIMEOUT = 15


class JsDownloadStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.JS_DOWNLOAD

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            js_files_path = self.output_dir / "js_files.txt"
            if not js_files_path.exists():
                return {"success": False, "error": "js_files.txt not found"}
            
            js_dir = self.output_dir / "js"
            js_dir.mkdir(exist_ok=True)
            
            js_urls = self.read_lines("js_files.txt")
            await self.info(f"Found {len(js_urls)} JS URLs to download (max {MAX_JS_FILES})")
            
            js_urls = js_urls[:MAX_JS_FILES]
            
            downloaded = 0
            failed = 0
            skipped = 0
            downloaded_files = []
            
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(DOWNLOAD_TIMEOUT),
                follow_redirects=True,
                limits=httpx.Limits(max_connections=CONCURRENT_DOWNLOADS),
                headers={"User-Agent": "Mozilla/5.0 Reconny/1.0"},
            ) as client:
                
                semaphore = asyncio.Semaphore(CONCURRENT_DOWNLOADS)
                
                async def download_js(url: str) -> None:
                    nonlocal downloaded, failed, skipped
                    async with semaphore:
                        try:
                            response = await client.get(url)
                            if response.status_code == 200:
                                content = response.content
                                content_hash = hashlib.sha256(content).hexdigest()
                                
                                existing_path = js_dir / f"{content_hash[:16]}.js"
                                if not existing_path.exists():
                                    existing_path.write_bytes(content)
                                
                                downloaded_files.append({
                                    "url": url,
                                    "path": str(existing_path),
                                    "hash": content_hash,
                                    "size": len(content),
                                })
                                downloaded += 1
                            else:
                                failed += 1
                        except Exception:
                            failed += 1
                
                tasks = [download_js(url) for url in js_urls]
                await asyncio.gather(*tasks)
            
            if downloaded_files:
                self.save_json(downloaded_files, "js_downloaded.json")
            
            await self.info(f"Downloaded {downloaded} JS files ({failed} failed, {skipped} skipped)")
            
            result_data = {
                "success": True,
                "downloaded": downloaded,
                "failed": failed,
                "skipped": skipped,
                "output_dir": str(js_dir),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}