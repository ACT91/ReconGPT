from pathlib import Path
from typing import Dict, Any
import re
from app.pipeline.base_stage import BasePipelineStage

class JSMiningStage(BasePipelineStage):
    PATTERNS = [
        r'["\']/(api|v\d+|admin|internal|private)/[a-zA-Z0-9/_-]+["\']',
        r'https?://[a-zA-Z0-9.-]+/[a-zA-Z0-9/_-]+',
        r'["\'][a-zA-Z0-9]+\.[a-zA-Z0-9]+\.[a-zA-Z]{2,}["\']',
    ]
    
    def execute(self) -> Dict[str, Any]:
        self.log("Starting JavaScript mining")
        
        js_dir = self.output_dir / "js"
        if not js_dir.exists():
            return {"success": False, "error": "JS directory not found"}
        
        endpoints = set()
        
        for js_file in js_dir.glob("*.js"):
            try:
                content = js_file.read_text(errors='ignore')
                
                for pattern in self.PATTERNS:
                    matches = re.findall(pattern, content)
                    for match in matches:
                        cleaned = match.strip('"\'')
                        if cleaned and len(cleaned) > 5:
                            endpoints.add(cleaned)
            except Exception:
                continue
        
        output_file = self.output_dir / "endpoints_hidden.txt"
        output_file.write_text('\n'.join(sorted(endpoints)))
        
        self.log(f"Mined {len(endpoints)} hidden endpoints from JS")
        
        return {
            "success": True,
            "endpoints_count": len(endpoints),
            "output_file": str(output_file)
        }
