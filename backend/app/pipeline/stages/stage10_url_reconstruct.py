from pathlib import Path
from typing import Dict, Any, Set
from urllib.parse import urlparse, urljoin
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage


class UrlReconstructStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.URL_RECONSTRUCT

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            endpoints_file = self.output_dir / "endpoints_merged.txt"
            live_hosts_file = self.output_dir / "live_hosts.json"
            
            if not endpoints_file.exists() or not live_hosts_file.exists():
                missing = []
                if not endpoints_file.exists():
                    missing.append("endpoints_merged.txt")
                if not live_hosts_file.exists():
                    missing.append("live_hosts.json")
                return {"success": False, "error": f"Missing files: {', '.join(missing)}"}
            
            # Extract URLs from JSONL format
            import json
            live_hosts = []
            with open(live_hosts_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data = json.loads(line)
                            url = data.get('url')
                            if url:
                                live_hosts.append(url)
                        except json.JSONDecodeError:
                            # Fallback for plain text
                            if line.startswith(('http://', 'https://')):
                                live_hosts.append(line)
            
            endpoints = self.read_lines("endpoints_merged.txt")
            
            full_urls: Set[str] = set()
            reconstructed_count = 0
            direct_count = 0
            
            for endpoint in endpoints:
                if endpoint.startswith(('http://', 'https://')):
                    full_urls.add(endpoint)
                    direct_count += 1
                else:
                    path = endpoint if endpoint.startswith('/') else f"/{endpoint}"
                    for host in live_hosts:
                        if host.startswith(('http://', 'https://')):
                            base = host.rstrip('/')
                            full_url = f"{base}{path}"
                        else:
                            full_url = f"https://{host.rstrip('/')}{path}"
                        full_urls.add(full_url)
                        reconstructed_count += 1
            
            self.write_lines("full_urls.txt", sorted(full_urls))
            
            await self.info(f"Reconstructed {len(full_urls)} full URLs ({direct_count} direct, {reconstructed_count} reconstructed)")
            
            result_data = {
                "success": True,
                "urls_count": len(full_urls),
                "direct_count": direct_count,
                "reconstructed_count": reconstructed_count,
                "output_file": str(self.output_dir / "full_urls.txt"),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}