from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
from pydantic import Field, PostgresDsn, RedisDsn
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Reconny"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # API
    API_V1_PREFIX: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: PostgresDsn
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 3600

    # Redis
    REDIS_URL: RedisDsn
    REDIS_MAX_CONNECTIONS: int = 50

    # Celery
    CELERY_BROKER_URL: RedisDsn
    CELERY_RESULT_BACKEND: RedisDsn
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TIMEZONE: str = "UTC"
    CELERY_ENABLE_UTC: bool = True
    CELERY_TASK_TRACK_STARTED: bool = True
    CELERY_TASK_TIME_LIMIT: int = 7200
    CELERY_WORKER_PREFETCH_MULTIPLIER: int = 1
    CELERY_WORKER_MAX_TASKS_PER_CHILD: int = 100

    # Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BCRYPT_ROUNDS: int = 12

    # AI / OpenAI
    OPENAI_API_KEY: str
    AI_BASE_URL: str = "https://api.opencode.dev/v1"
    AI_MODEL: str = "deepseek-v4-flash-free"
    AI_TEMPERATURE: float = 0.3
    AI_MAX_TOKENS: int = 4096
    AI_TIMEOUT: int = 120

    # Tool Paths
    SUBFINDER_PATH: str = "/usr/local/bin/subfinder"
    HTTPX_PATH: str = "/usr/local/bin/httpx"
    KATANA_PATH: str = "/usr/local/bin/katana"
    NUCLEI_PATH: str = "/usr/local/bin/nuclei"
    GAU_PATH: str = "/usr/local/bin/gau"

    # Storage
    STORAGE_PATH: str = "./storage/jobs"
    MAX_STORAGE_PER_JOB_GB: int = 10
    JOB_RETENTION_DAYS: int = 30

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    MAX_CONCURRENT_SCANS_PER_USER: int = 3
    SCAN_RATE_LIMIT_PER_HOUR: int = 10

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: str = "./logs/reconny.log"

    # Security
    ALLOWED_DOMAINS: str = "*"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    TRUSTED_HOSTS: List[str] = ["localhost", "127.0.0.1"]

    # Health Checks
    HEALTH_CHECK_INTERVAL: int = 30

    # Monitoring
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()