from pathlib import Path
from typing import Dict, Any
from app.utils.subprocess_runner import run_command
from app.core.config import settings

def run_subfinder(domain: str, output_file: Path) -> Dict[str, Any]:
    cmd = [
        settings.SUBFINDER_PATH,
        "-d", domain,
        "-o", str(output_file),
        "-silent"
    ]
    
    result = run_command(cmd, timeout=600)
    
    if result["returncode"] != 0:
        return {"success": False, "error": result["stderr"]}
    
    return {"success": True, "output": result["stdout"]}
