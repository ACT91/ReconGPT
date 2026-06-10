from pathlib import Path
from typing import Dict, Any
import json
from app.utils.subprocess_runner import run_command
from app.core.config import settings

def run_nuclei(input_file: Path, output_file: Path) -> Dict[str, Any]:
    cmd = [
        settings.NUCLEI_PATH,
        "-l", str(input_file),
        "-jsonl",
        "-o", str(output_file),
        "-silent"
    ]
    
    result = run_command(cmd, timeout=3600)
    
    if result["returncode"] != 0:
        return {"success": False, "error": result["stderr"]}
    
    # Count vulnerabilities
    vulns_count = 0
    if output_file.exists():
        with open(output_file) as f:
            vulns_count = sum(1 for _ in f)
    
    return {"success": True, "vulnerabilities_count": vulns_count}
