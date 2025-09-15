import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # Application settings
    app_name: str = "PeopleSense"
    debug: bool = Field(default=False, env="DEBUG")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_file: str = Field(default="logs/peoplesense.log", env="LOG_FILE")
    
    # Processing settings
    model_path: str = Field(default="yolov8n.pt", env="MODEL_PATH")
    device: str = Field(default="auto", env="DEVICE")
    confidence_threshold: float = Field(default=0.25, env="CONFIDENCE_THRESHOLD")
    
    # Batch processing settings
    enable_batch_processing: bool = Field(default=True, env="ENABLE_BATCH_PROCESSING")
    batch_size: int = Field(default=4, env="BATCH_SIZE")
    
    # Camera settings
    max_cameras: int = Field(default=16, env="MAX_CAMERAS")
    reconnect_interval: int = Field(default=5, env="RECONNECT_INTERVAL")
    
    # API settings
    cors_origins: list = Field(default=["*"], env="CORS_ORIGINS")
    
    # Storage settings
    config_file: str = Field(default="cameras.json", env="CONFIG_FILE")
    
    class Config:
        env_file = ".env"

# Create settings instance
settings = Settings()