from pathlib import Path
from typing import Dict, Any, Set
from app.pipeline.base_stage import PipelineStageBase
from app.models.job import PipelineStage


SOURCE_FILES = [
    "endpoints_crawl.txt",
    "endpoints_hidden.txt",
    "endpoints_api.txt",
]


class EndpointMergeStage(PipelineStageBase):
    @property
    def stage_name(self) -> PipelineStage:
        return PipelineStage.ENDPOINT_MERGE

    async def execute(self) -> Dict[str, Any]:
        await self.mark_started()
        
        try:
            all_endpoints: Set[str] = set()
            source_counts = {}
            
            for filename in SOURCE_FILES:
                filepath = self.output_dir / filename
                if filepath.exists():
                    lines = self.read_lines(filename)
                    all_endpoints.update(lines)
                    source_counts[filename] = len(lines)
                    await self.info(f"Loaded {len(lines)} endpoints from {filename}")
                else:
                    source_counts[filename] = 0
                    await self.info(f"Source file '{filename}' not found, skipping")
            
            self.write_lines("endpoints_merged.txt", sorted(all_endpoints))
            
            await self.info(f"Merged {len(all_endpoints)} unique endpoints from all sources")
            
            result_data = {
                "success": True,
                "endpoints_count": len(all_endpoints),
                "source_counts": source_counts,
                "output_file": str(self.output_dir / "endpoints_merged.txt"),
            }
            
            await self.mark_completed(result_data)
            return result_data
            
        except Exception as e:
            await self.mark_failed(str(e))
            return {"success": False, "error": str(e)}