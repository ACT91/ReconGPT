from pathlib import Path
from typing import Dict, Any
import httpx
from app.pipeline.base_stage import BasePipelineStage

class JSDownloadStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting JavaScript download")
        
        js_files_list = self.output_dir / "js_files.txt"
        if not js_files_list.exists():
            return {"success": False, "error": "js_files.txt not found"}
        
        js_dir = self.output_dir / "js"
        js_dir.mkdir(exist_ok=True)
        
        downloaded = 0
        failed = 0
        
        with open(js_files_list) as f:
            js_urls = [line.strip() for line in f if line.strip()]
        
        for url in js_urls[:100]:  # Limit to 100 files
            try:
                response = httpx.get(url, timeout=10, follow_redirects=True)
                if response.status_code == 200:
                    filename = url.split('/')[-1].split('?')[0] or 'script.js'
                    filepath = js_dir / f"{downloaded}_{filename}"
                    filepath.write_bytes(response.content)
                    downloaded += 1
            except Exception:
                failed += 1
        
        self.log(f"Downloaded {downloaded} JavaScript files ({failed} failed)")
        
        return {
            "success": True,
            "downloaded": downloaded,
            "failed": failed
        }
