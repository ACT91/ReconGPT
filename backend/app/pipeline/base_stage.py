from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import structlog

from app.core.config import settings
from app.core.database import async_session_factory
from app.models.job import ScanJob, PipelineStage, ScanStatus
from app.models.pipeline_log import PipelineLog, LogLevel
from app.core.websocket_manager import emit_stage_progress, emit_stage_log


logger = structlog.get_logger(__name__)


class PipelineStageBase(ABC):
    def __init__(self, job_id: str, target: str, storage_path: Path, db_session: Optional[AsyncSession] = None):
        self.job_id = job_id
        self.target = target
        self.storage_path = storage_path
        self.output_dir = storage_path / job_id
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._db = db_session

    @abstractmethod
    async def execute(self) -> Dict[str, Any]:
        pass

    @property
    def stage_name(self) -> PipelineStage:
        raise NotImplementedError

    async def log(self, level: LogLevel, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        log_methods = {
            LogLevel.DEBUG: logger.debug,
            LogLevel.INFO: logger.info,
            LogLevel.WARNING: logger.warning,
            LogLevel.ERROR: logger.error,
            LogLevel.CRITICAL: logger.critical,
        }
        method = log_methods.get(level, logger.info)
        method(
            f"[{self.job_id}] {message}",
            job_id=self.job_id,
            stage=self.stage_name.value if self.stage_name else None,
            **details or {},
        )
        
        await self._save_log(level, message, details)

    async def info(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        await self.log(LogLevel.INFO, message, details)

    async def warning(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        await self.log(LogLevel.WARNING, message, details)

    async def error(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        await self.log(LogLevel.ERROR, message, details)

    async def _save_log(self, level: LogLevel, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        try:
            async with async_session_factory() as session:
                log_entry = PipelineLog(
                    scan_job_id=UUID(self.job_id),
                    stage=self.stage_name,
                    level=level,
                    message=message,
                    details=details or {},
                )
                session.add(log_entry)
                await session.commit()
        except Exception as e:
            logger.warning(f"Failed to save pipeline log: {e}")

        try:
            await emit_stage_log(
                job_id=UUID(self.job_id),
                stage=self.stage_name.value if self.stage_name else "unknown",
                level=level.value,
                message=message,
                details=details,
            )
        except Exception as e:
            logger.warning(f"Failed to emit WebSocket log: {e}")

    async def update_job_status(self, status: ScanStatus, stage: Optional[PipelineStage] = None, error: Optional[str] = None) -> None:
        try:
            async with async_session_factory() as session:
                result = await session.execute(
                    select(ScanJob).where(ScanJob.id == UUID(self.job_id))
                )
                job = result.scalar_one_or_none()
                if job:
                    job.status = status
                    if stage:
                        job.current_stage = stage
                        from app.models.job import STAGE_PROGRESS
                        job.progress_percent = STAGE_PROGRESS.get(stage, job.progress_percent)
                    if error:
                        job.error_message = error
                    if status == ScanStatus.RUNNING and not job.started_at:
                        job.started_at = datetime.now(timezone.utc)
                    if status in [ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.CANCELLED]:
                        job.completed_at = datetime.now(timezone.utc)
                    job.updated_at = datetime.now(timezone.utc)
                    await session.commit()
        except Exception as e:
            logger.warning(f"Failed to update job status: {e}")

        try:
            stage_name = stage.value if stage else (self.stage_name.value if self.stage_name else None)
            await emit_stage_progress(
                job_id=UUID(self.job_id),
                stage=stage_name or "unknown",
                progress=job.progress_percent if job else 0,
                message=f"Status: {status.value}",
            )
        except Exception as e:
            logger.warning(f"Failed to emit WebSocket progress: {e}")

    async def mark_started(self) -> None:
        await self.update_job_status(ScanStatus.RUNNING, self.stage_name)
        await self.info(f"Stage '{self.stage_name.value}' started")

    async def mark_completed(self, result: Dict[str, Any]) -> None:
        await self.info(f"Stage '{self.stage_name.value}' completed", result)
        await self.update_job_status(ScanStatus.RUNNING, self.stage_name)

    async def mark_failed(self, error: str) -> None:
        await self.error(f"Stage '{self.stage_name.value}' failed: {error}")
        await self.update_job_status(ScanStatus.FAILED, self.stage_name, error)

    def save_json(self, data: Any, filename: str) -> Path:
        path = self.output_dir / filename
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
        return path

    def read_file(self, filename: str) -> str:
        path = self.output_dir / filename
        if not path.exists():
            return ""
        return path.read_text(encoding='utf-8', errors='ignore')

    def read_lines(self, filename: str) -> List[str]:
        content = self.read_file(filename)
        return [line.strip() for line in content.split('\n') if line.strip()]

    def read_json(self, filename: str) -> Optional[Any]:
        path = self.output_dir / filename
        if not path.exists():
            return None
        with open(path) as f:
            return json.load(f)

    def write_lines(self, filename: str, lines: List[str]) -> Path:
        path = self.output_dir / filename
        path.write_text('\n'.join(sorted(set(lines))))
        return path