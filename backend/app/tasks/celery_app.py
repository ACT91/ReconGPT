from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "recongpt",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.scan_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=7200,  # 2 hours
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=settings.WORKER_MAX_TASKS_PER_CHILD
)
