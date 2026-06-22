from pathlib import Path
from typing import Dict, Any, Optional, List
from app.utils.subprocess_runner import run_command_async
from app.core.config import settings


async def run_nuclei(
    input_file: Path,
    output_file: Path,
    templates: Optional[List[str]] = None,
    severity: Optional[List[str]] = None,
    rate_limit: int = 150,
    concurrency: int = 25,
) -> Dict[str, Any]:
    cmd = [
        settings.NUCLEI_PATH,
        "-l", str(input_file),
        "-jsonl",
        "-o", str(output_file),
        "-silent",
        "-stats",
        "-retries", "2",
        "-rate-limit", str(rate_limit),
        "-concurrency", str(concurrency),
        "-timeout", "10",
    ]
    
    if templates:
        for t in templates:
            cmd.extend(["-t", t])
    else:
        cmd.extend(["-severity", "critical,high,medium,low"])
    
    if severity:
        cmd.extend(["-severity", ",".join(severity)])
    
    result = await run_command_async(cmd, timeout=3600)
    
    vulnerabilities_count = 0
    resolved_storage = Path(settings.STORAGE_PATH).resolve()
    resolved_output = output_file.resolve()
    if resolved_output.exists() and resolved_output.is_relative_to(resolved_storage):
        with open(resolved_output, encoding="utf-8", errors="ignore") as f:
            vulnerabilities_count = sum(1 for _ in f)
    
    if result["returncode"] < 0:
        return {"success": False, "error": result["stderr"][:1000], "vulnerabilities_count": vulnerabilities_count}
    
    return {"success": True, "vulnerabilities_count": vulnerabilities_count}