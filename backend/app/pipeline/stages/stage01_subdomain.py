from pathlib import Path
from typing import Dict, Any, List
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage
from app.models.pipeline_log import LogLevel
from app.integrations.subfinder import run_subfinder
from app.integrations.gau import run_gau


class SubdomainEnumStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.SUBDOMAIN_ENUM

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            output_file = self.output_dir / "subdomains.txt"
            
            await self.info("Running subfinder for subdomain enumeration")
            result = await run_subfinder(self.target, output_file)
            
            all_subdomains: List[str] = []
            
            if result.get("success"):
                subdomains = self.read_lines("subdomains.txt")
                all_subdomains.extend(subdomains)
                await self.info(f"Subfinder found {len(subdomains)} subdomains")
            else:
                await self.warning(f"Subfinder failed: {result.get('error', 'Unknown error')}")
            
            gau_file = self.output_dir / "subdomains_gau.txt"
            await self.info("Running gau for additional subdomains")
            gau_result = await run_gau(self.target, gau_file)
            
            if gau_result.get("success"):
                gau_subdomains = self.read_lines("subdomains_gau.txt")
                all_subdomains.extend(gau_subdomains)
                await self.info(f"Gau found {len(gau_subdomains)} additional subdomains")
            else:
                await self.warning(f"Gau failed: {gau_result.get('error', 'Unknown error')}")
            
            unique_subdomains = sorted(set(all_subdomains))
            self.write_lines("subdomains.txt", unique_subdomains)
            
            await self.info(f"Total unique subdomains: {len(unique_subdomains)}")
            
            result_data = {
                "success": True,
                "subdomains_count": len(unique_subdomains),
                "output_file": str(output_file),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}