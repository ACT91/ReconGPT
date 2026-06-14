from pathlib import Path
from typing import Dict, Any, List, Set
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage


JS_EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue'}
JS_KEYWORDS = ['/js/', '/static/js/', '/assets/js/', '/scripts/', '/javascript/']


class JsExtractStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.JS_EXTRACT

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            katana_output = self.output_dir / "katana" / "katana_output.txt"
            if not katana_output.exists():
                return {"success": False, "error": "Katana output not found"}
            
            js_files: Set[str] = set()
            
            with open(katana_output, encoding='utf-8', errors='ignore') as f:
                for line in f:
                    url = line.strip()
                    if not url:
                        continue
                    
                    lower_url = url.lower()
                    if any(lower_url.endswith(ext) for ext in JS_EXTENSIONS):
                        js_files.add(url)
                    elif any(keyword in lower_url for keyword in JS_KEYWORDS) and not any(
                        lower_url.endswith(ext) for ext in ['.css', '.jpg', '.png', '.gif', '.svg', '.ico']
                    ):
                        js_files.add(url)
            
            js_list = sorted(js_files)
            output_file = self.output_dir / "js_files.txt"
            output_file.write_text('\n'.join(js_list), encoding='utf-8')
            
            await self.info(f"Extracted {len(js_files)} JavaScript files from crawl results")
            
            result_data = {
                "success": True,
                "js_files_count": len(js_files),
                "output_file": str(output_file),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}