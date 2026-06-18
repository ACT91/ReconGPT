import asyncio
from typing import Dict, Any, Optional, List
from pathlib import Path
import structlog


logger = structlog.get_logger(__name__)


async def run_command_async(
    cmd: List[str],
    timeout: int = 300,
    cwd: Optional[Path] = None,
    output_file: Optional[Path] = None,
    env: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    try:
        logger.info("running_command", cmd=" ".join(cmd), timeout=timeout)
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(cwd) if cwd else None,
            env=env,
        )
        
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            logger.warning("command_timed_out", cmd=" ".join(cmd), timeout=timeout)
            return {
                "returncode": -1,
                "stdout": "",
                "stderr": f"Command timed out after {timeout}s",
                "success": False,
            }
        
        stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
        stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
        
        if output_file and stdout:
            output_file.write_text(stdout, encoding="utf-8")
        
        success = process.returncode == 0
        
        if not success:
            logger.warning(
                "command_failed",
                cmd=" ".join(cmd),
                returncode=process.returncode,
                stderr=stderr[:500],
            )
        
        return {
            "returncode": process.returncode or 0,
            "stdout": stdout,
            "stderr": stderr,
            "success": success,
        }
        
    except FileNotFoundError:
        logger.error("command_not_found", cmd=cmd[0] if cmd else "empty")
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": f"Command not found: {cmd[0] if cmd else 'empty'}",
            "success": False,
        }
    except Exception as e:
        logger.error("command_exception", cmd=" ".join(cmd), error=str(e))
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": str(e),
            "success": False,
        }