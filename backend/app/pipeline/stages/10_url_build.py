from pathlib import Path
from typing import Dict, Any
from urllib.parse import urlparse, urljoin
from app.pipeline.base_stage import BasePipelineStage

class URLBuildStage(BasePipelineStage):
    def execute(self) -> Dict[str, Any]:
        self.log("Starting URL reconstruction")
        
        endpoints_file = self.output_dir / "endpoints_final.txt"
        live_hosts_file = self.output_dir / "live_hosts.txt"
        
        if not endpoints_file.exists() or not live_hosts_file.exists():
            return {"success": False, "error": "Required files not found"}
        
        live_hosts = self.read_lines("live_hosts.txt")
        endpoints = self.read_lines("endpoints_final.txt")
        
        full_urls = set()
        
        for endpoint in endpoints:
            if endpoint.startswith(('http://', 'https://')):
                full_urls.add(endpoint)
            else:
                for host in live_hosts:
                    full_url = urljoin(host, endpoint)
                    full_urls.add(full_url)
        
        output_file = self.output_dir / "full_urls.txt"
        output_file.write_text('\n'.join(sorted(full_urls)))
        
        self.log(f"Reconstructed {len(full_urls)} full URLs")
        
        return {
            "success": True,
            "urls_count": len(full_urls),
            "output_file": str(output_file)
        }
