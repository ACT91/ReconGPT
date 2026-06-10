from pathlib import Path
from typing import Dict, Any
from app.pipeline.base_stage import BasePipelineStage

class JSExtractStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting JavaScript extraction")
        
        katana_output = self.output_dir / "katana" / "katana_output.txt"
        if not katana_output.exists():
            return {"success": False, "error": "Katana output not found"}
        
        js_files = set()
        
        with open(katana_output) as f:
            for line in f:
                line = line.strip()
                if any(line.endswith(ext) for ext in ['.js', '.jsx', '.ts', '.tsx']):
                    js_files.add(line)
        
        output_file = self.output_dir / "js_files.txt"
        output_file.write_text('\n'.join(sorted(js_files)))
        
        self.log(f"Extracted {len(js_files)} JavaScript files")
        
        return {
            "success": True,
            "js_files_count": len(js_files),
            "output_file": str(output_file)
        }
