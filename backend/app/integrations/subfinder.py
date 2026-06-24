from pathlib import Path
from typing import Dict, Any, Optional
from app.utils.subprocess_runner import run_command_async
from app.core.config import settings


async def run_subfinder(
    domain: str,
    output_file: Path,
    sources: Optional[list[str]] = None,
) -> Dict[str, Any]:
    cmd = [
        settings.SUBFINDER_PATH,
        "-d", domain,
        "-o", str(output_file),
        "-silent",
        "-all",
        "-timeout", "120",
        "-r", "1.1.1.1,8.8.8.8",
    ]
    
    if sources:
        cmd.extend(["-s", ",".join(sources)])
    
    result = await run_command_async(cmd, timeout=600)
    
    if not result["success"] and result["returncode"] != 0:
        return {"success": False, "error": result["stderr"][:1000]}
    
    return {"success": True, "stdout": result["stdout"]}