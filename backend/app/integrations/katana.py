from pathlib import Path
from typing import Dict, Any
from app.utils.subprocess_runner import run_command
from app.core.config import settings

def run_katana(input_file: Path, output_dir: Path) -> Dict[str, Any]:
    output_file = output_dir / "katana_output.txt"
    
    cmd = [
        settings.KATANA_PATH,
        "-list", str(input_file),
        "-o", str(output_file),
        "-silent",
        "-jc",  # JavaScript crawling
        "-kf", "all",  # Known files
        "-depth", "3"
    ]
    
    result = run_command(cmd, timeout=1800)
    
    if result["returncode"] != 0:
        return {"success": False, "error": result["stderr"]}
    
    # Count URLs
    urls_count = 0
    if output_file.exists():
        urls_count = len(output_file.read_text().strip().split('\n'))
    
    return {"success": True, "urls_count": urls_count}
