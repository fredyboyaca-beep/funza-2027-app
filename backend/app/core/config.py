from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FUNZA 2027 - CENTRO DE INTELIGENCIA ELECTORAL"
    DATABASE_URL: str = "sqlite:///./funza2027.db"
    SECRET_KEY: str = "dev-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://funza-2027-app.vercel.app"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
