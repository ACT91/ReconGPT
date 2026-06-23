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

    async def _download_single_js(
        self, url: str, client: httpx.AsyncClient, semaphore: asyncio.Semaphore,
        js_dir: Path, downloaded_files: list
    ) -> tuple[int, int]:
        async with semaphore:
            try:
                response = await client.get(url)
                if response.status_code != 200:
                    return 0, 1
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
                return 1, 0
            except Exception:
                return 0, 1

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            js_files_path = self.output_dir / "js_files.txt"
            if not js_files_path.exists():
                return {"success": False, "error": "js_files.txt not found"}
            
            js_dir = self.output_dir / "js"
            js_dir.mkdir(exist_ok=True)
            
            js_urls = self.read_lines("js_files.txt")[:MAX_JS_FILES]
            await self.info(f"Downloading up to {len(js_urls)} JS files")
            
            downloaded_files = []
            
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(DOWNLOAD_TIMEOUT),
                follow_redirects=True,
                limits=httpx.Limits(max_connections=CONCURRENT_DOWNLOADS),
                headers={"User-Agent": "Mozilla/5.0 Reconny/1.0"},
            ) as client:
                semaphore = asyncio.Semaphore(CONCURRENT_DOWNLOADS)
                tasks = [self._download_single_js(url, client, semaphore, js_dir, downloaded_files) for url in js_urls]
                results = await asyncio.gather(*tasks)
            
            downloaded = sum(r[0] for r in results)
            failed = sum(r[1] for r in results)
            
            if downloaded_files:
                self.save_json(downloaded_files, "js_downloaded.json")
            
            await self.info(f"Downloaded {downloaded} JS files ({failed} failed)")
            
            result_data = {
                "success": True,
                "downloaded": downloaded,
                "failed": failed,
                "skipped": 0,
                "output_dir": str(js_dir),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}