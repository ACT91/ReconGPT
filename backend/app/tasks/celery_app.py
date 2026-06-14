from celery import Celery
from app.core.config import settings


celery_app = Celery(
    "reconny",
    broker=str(settings.CELERY_BROKER_URL),
    backend=str(settings.CELERY_RESULT_BACKEND),
    include=[
        "app.tasks.scan_tasks",
    ],
)

celery_app.conf.update(
    task_serializer=settings.CELERY_TASK_SERIALIZER,
    accept_content=settings.CELERY_ACCEPT_CONTENT,
    result_serializer=settings.CELERY_RESULT_SERIALIZER,
    timezone=settings.CELERY_TIMEZONE,
    enable_utc=settings.CELERY_ENABLE_UTC,
    task_track_started=settings.CELERY_TASK_TRACK_STARTED,
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
    worker_prefetch_multiplier=settings.CELERY_WORKER_PREFETCH_MULTIPLIER,
    worker_max_tasks_per_child=settings.CELERY_WORKER_MAX_TASKS_PER_CHILD,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    result_expires=86400,
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=10,
)


celery_app.conf.task_routes = {
    "execute_full_pipeline": {"queue": "pipeline"},
    "execute_scan_stage": {"queue": "stages"},
    "execute_ai_analysis": {"queue": "ai"},
}


celery_app.conf.task_annotations = {
    "execute_full_pipeline": {
        "rate_limit": "1/m",
        "max_retries": 3,
        "default_retry_delay": 60,
        "acks_late": True,
    },
    "execute_scan_stage": {
        "max_retries": 2,
        "default_retry_delay": 30,
        "acks_late": True,
    },
}


celery_app.conf.beat_schedule = {
    "cleanup-expired-jobs": {
        "task": "cleanup_expired_jobs",
        "schedule": 86400.0,
    },
}