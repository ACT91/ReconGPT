import subprocess
from typing import Dict, Any, Optional, List
from pathlib import Path
from app.core.logger import logger

def run_command(
    cmd: List[str],
    timeout: int = 300,
    cwd: Optional[Path] = None,
    output_file: Optional[Path] = None
) -> Dict[str, Any]:
    try:
        logger.info(f"Running command: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd
        )
        
        if output_file and result.stdout:
            output_file.write_text(result.stdout)
        
        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0
        }
        
    except subprocess.TimeoutExpired:
        logger.error(f"Command timed out after {timeout}s")
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": f"Command timed out after {timeout}s",
            "success": False
        }
    except Exception as e:
        logger.error(f"Command failed: {str(e)}")
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": str(e),
            "success": False
        }
