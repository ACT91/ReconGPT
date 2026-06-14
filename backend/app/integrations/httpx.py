from pathlib import Path
from typing import Dict, Any, List, Optional
from app.utils.subprocess_runner import run_command_async
from app.core.config import settings


async def run_httpx_probe(
    input_file: Path,
    output_file: Path,
    json_output: Optional[Path] = None,
    ports: Optional[List[int]] = None,
) -> Dict[str, Any]:
    cmd = [
        settings.HTTPX_PATH,
        "-l", str(input_file),
        "-o", str(output_file),
        "-silent",
        "-status-code",
        "-tech-detect",
        "-title",
        "-web-server",
        "-content-length",
        "-response-time",
        "-follow-redirects",
        "-threads", "50",
        "-timeout", "10",
    ]
    
    if ports:
        cmd.extend(["-ports", ",".join(str(p) for p in ports)])
    
    if json_output:
        cmd.extend(["-json", "-j", str(json_output)])
    
    result = await run_command_async(cmd, timeout=1800)
    
    if not result["success"] and result["returncode"] != 0:
        return {"success": False, "error": result["stderr"][:1000]}
    
    return {"success": True, "stdout": result["stdout"]}


async def run_httpx_endpoint_probe(
    input_file: Path,
    output_file: Path,
    methods: Optional[List[str]] = None,
) -> Dict[str, Any]:
    cmd = [
        settings.HTTPX_PATH,
        "-l", str(input_file),
        "-o", str(output_file),
        "-silent",
        "-status-code",
        "-content-length",
        "-response-time",
        "-mc", "200,201,204,301,302,303,307,308,401,403,404,405,500",
        "-threads", "50",
        "-timeout", "15",
        "-follow-redirects",
    ]
    
    if methods:
        cmd.extend(["-x", ",".join(methods)])
    
    result = await run_command_async(cmd, timeout=3600)
    
    if not result["success"] and result["returncode"] != 0:
        return {"success": False, "error": result["stderr"][:1000]}
    
    return {"success": True, "stdout": result["stdout"]}