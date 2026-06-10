from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    
    # Redis
    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # AI
    OPENAI_API_KEY: str
    AI_MODEL: str = "gpt-4"
    AI_TEMPERATURE: float = 0.3
    
    # Tools
    SUBFINDER_PATH: str = "/usr/local/bin/subfinder"
    HTTPX_PATH: str = "/usr/local/bin/httpx"
    KATANA_PATH: str = "/usr/local/bin/katana"
    NUCLEI_PATH: str = "/usr/local/bin/nuclei"
    
    # Storage
    STORAGE_PATH: str = "./storage/jobs"
    MAX_STORAGE_PER_JOB_GB: int = 10
    
    # Worker
    WORKER_CONCURRENCY: int = 4
    WORKER_MAX_TASKS_PER_CHILD: int = 100
    WORKER_TIMEOUT_SECONDS: int = 3600
    
    # Rate Limiting
    RATE_LIMIT_PER_USER_PER_HOUR: int = 10
    MAX_CONCURRENT_SCANS_PER_USER: int = 3
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "./logs/recongpt.log"
    
    # Security
    ALLOWED_DOMAINS: str = "*"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
