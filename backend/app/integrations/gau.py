from pathlib import Path
from typing import Dict, Any, List, Optional
from app.utils.subprocess_runner import run_command_async
from app.core.config import settings


async def run_gau(
    domain: str,
    output_file: Path,
    subdomains: bool = True,
    providers: Optional[List[str]] = None,
) -> Dict[str, Any]:
    cmd = [
        settings.GAU_PATH,
        "--o", str(output_file),
        "--threads", "10",
        "--retries", "2",
        "--timeout", "10",
    ]
    
    if subdomains:
        cmd.append("--subs")
    
    if providers:
        cmd.extend(["--providers", ",".join(providers)])
    
    cmd.append(domain)
    
    result = await run_command_async(cmd, timeout=600)
    
    urls_count = 0
    subdomain_count = 0
    if output_file.exists():
        content = output_file.read_text(encoding="utf-8", errors="ignore")
        lines = [l.strip() for l in content.split('\n') if l.strip()]
        urls_count = len(lines)
        
        from urllib.parse import urlparse
        from app.core.logger import get_logger
        _logger = get_logger(__name__)
        unique_domains = set()
        for line in lines:
            try:
                parsed = urlparse(line)
                host = parsed.hostname or ""
                if host.endswith(domain):
                    unique_domains.add(host)
            except ValueError:
                _logger.warning("gau_url_parse_failed", url=line[:200])
                continue
        subdomain_count = len(unique_domains)
    
    if not result["success"] and result["returncode"] != 0:
        return {"success": False, "error": result["stderr"][:1000], "urls_count": urls_count, "subdomain_count": subdomain_count}
    
    return {"success": True, "urls_count": urls_count, "subdomain_count": subdomain_count}