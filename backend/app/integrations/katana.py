from pathlib import Path
from typing import Dict, Any, Optional
from app.utils.subprocess_runner import run_command_async
from app.core.config import settings


async def run_katana(
    input_file: Path,
    output_dir: Path,
    depth: int = 3,
    rate_limit: Optional[int] = 50,
) -> Dict[str, Any]:
    output_file = output_dir / "katana_output.txt"
    
    cmd = [
        settings.KATANA_PATH,
        "-list", str(input_file),
        "-o", str(output_file),
        "-silent",
        "-jc",
        "-kf", "all",
        "-depth", str(depth),
        "-c", "50",
        "-timeout", "10",
        "-retry", "2",
    ]
    
    if rate_limit:
        cmd.extend(["-rl", str(rate_limit)])
    
    result = await run_command_async(cmd, timeout=3600)
    
    urls_count = 0
    if output_file.exists():
        urls_count = len(output_file.read_text(encoding="utf-8", errors="ignore").strip().split('\n'))
    
    if not result["success"] and result["returncode"] != 0:
        return {"success": False, "error": result["stderr"][:1000], "urls_count": urls_count}
    
    return {"success": True, "urls_count": urls_count}