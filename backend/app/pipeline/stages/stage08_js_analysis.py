from pathlib import Path
from typing import Dict, Any, Set, List
import re
import json
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage


HIDDEN_ENDPOINT_PATTERNS = [
    r'(?:"|\')(/[a-zA-Z0-9_\-./]+)(?:"|\')',
    r'(api|v1|v2|v3|api/v1|api/v2|admin|internal|private|graphql|rest)\/[a-zA-Z0-9_\-./]+',
    r'url\s*:\s*["\']([^"\']+)["\']',
    r'endpoint\s*:\s*["\']([^"\']+)["\']',
    r'path\s*:\s*["\']([^"\']+)["\']',
]

API_PATTERNS = [
    r'(?:"|\')(/[a-zA-Z0-9_\-./]*(?:api|graphql|rest|v1|v2|auth|login|signup|token|webhook|callback|upload|download)[a-zA-Z0-9_\-./]*)(?:"|\')',
]

SECRET_PATTERNS = [
    (r'(?i)(?:api[_-]?key|apikey)\s*[=:]\s*["\']([^"\']+)["\']', "API Key"),
    (r'(?i)(?:secret|token|password|passwd|pwd)\s*[=:]\s*["\']([^"\']+)["\']', "Secret/Token"),
    (r'(?i)aws_access_key_id\s*[=:]\s*["\']?([^"\'\s]+)', "AWS Access Key"),
    (r'(?i)aws_secret_access_key\s*[=:]\s*["\']?([^"\'\s]+)', "AWS Secret Key"),
    (r'(?i)AKIA[0-9A-Z]{16}', "AWS Key ID"),
    (r'(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}', "GitHub Token"),
    (r'sk-[a-zA-Z0-9]{32,}', "Secret Key"),
    (r'(?i)(?:password|passwd|pwd)\s*[:=]\s*["\']([^"\']{8,})["\']', "Hardcoded Password"),
]


class JsAnalysisStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.JS_ANALYSIS

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            js_dir = self.output_dir / "js"
            if not js_dir.exists():
                return {"success": False, "error": "JS directory not found"}
            
            hidden_endpoints: Set[str] = set()
            api_endpoints: Set[str] = set()
            secrets: List[Dict[str, Any]] = []
            analyzed_count = 0
            
            js_files = list(js_dir.glob("*.js")) + list(js_dir.glob("*.ts"))
            await self.info(f"Analyzing {len(js_files)} JS files")
            
            for js_file in js_files:
                try:
                    content = js_file.read_text(encoding='utf-8', errors='ignore')
                    analyzed_count += 1
                    
                    for pattern in HIDDEN_ENDPOINT_PATTERNS:
                        matches = re.findall(pattern, content)
                        for m in matches:
                            if isinstance(m, tuple):
                                m = m[0]
                            m = m.strip('"\'')
                            if len(m) > 3 and not m.startswith(('http://', 'https://', '//')):
                                hidden_endpoints.add(m)
                    
                    for pattern in API_PATTERNS:
                        matches = re.findall(pattern, content)
                        for m in matches:
                            if isinstance(m, tuple):
                                m = m[0]
                            api_endpoints.add(m.strip('"\''))
                    
                    for pattern, secret_type in SECRET_PATTERNS:
                        matches = re.findall(pattern, content)
                        for m in matches:
                            if isinstance(m, tuple):
                                m = m[0]
                            if len(m) > 6:
                                secrets.append({
                                    "type": secret_type,
                                    "value": m[:50] + "..." if len(m) > 50 else m,
                                    "file": js_file.name,
                                })
                
                except Exception:
                    continue
            
            self.write_lines("endpoints_hidden.txt", sorted(hidden_endpoints))
            self.write_lines("endpoints_api.txt", sorted(api_endpoints))
            
            if secrets:
                self.save_json(secrets, "js_secrets.json")
            
            await self.info(f"Analyzed {analyzed_count} files: found {len(hidden_endpoints)} hidden endpoints, {len(api_endpoints)} API endpoints, {len(secrets)} potential secrets")
            
            result_data = {
                "success": True,
                "files_analyzed": analyzed_count,
                "hidden_endpoints": len(hidden_endpoints),
                "api_endpoints": len(api_endpoints),
                "secrets_found": len(secrets),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}