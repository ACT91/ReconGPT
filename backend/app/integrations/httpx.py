from pathlib import Path
from typing import Dict, Any
from app.utils.subprocess_runner import run_command
from app.core.config import settings

def run_httpx_probe(input_file: Path, output_file: Path, json_output: Path) -> Dict[str, Any]:
    cmd = [
        settings.HTTPX_PATH,
        "-l", str(input_file),
        "-o", str(output_file),
        "-json",
        "-silent",
        "-status-code",
        "-tech-detect",
        "-title",
        "-web-server"
    ]
    
    result = run_command(cmd, timeout=900, output_file=json_output)
    
    if result["returncode"] != 0:
        return {"success": False, "error": result["stderr"]}
    
    return {"success": True}

def run_httpx_endpoint_probe(input_file: Path, output_file: Path) -> Dict[str, Any]:
    cmd = [
        settings.HTTPX_PATH,
        "-l", str(input_file),
        "-o", str(output_file),
        "-silent",
        "-status-code",
        "-mc", "200,201,301,302,401,403"
    ]
    
    result = run_command(cmd, timeout=1800)
    
    if result["returncode"] != 0:
        return {"success": False, "error": result["stderr"]}
    
    return {"success": True}
