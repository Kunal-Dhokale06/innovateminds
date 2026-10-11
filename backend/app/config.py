from pydantic_settings import BaseSettings
from pydantic import Field, ConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "ModelRouter"
    APP_ENV: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # Database: SQLite for zero-config Windows execution, PostgreSQL for containerized deployments
    DATABASE_URL: str = Field(
        default="sqlite:///./modelrouter.db",
        description="SQLAlchemy database URL"
    )
    
    # Master key for AES-256 encryption of provider API keys
    MODELROUTER_MASTER_KEY: str = Field(
        default="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        description="Master 32-byte hex key for credentials encryption"
    )
    
    # Upstream Provider Keys (Optional in dev/test, fallback to Mock)
    OPENAI_API_KEY: str = Field(default="", description="Default OpenAI API key")
    GEMINI_API_KEY: str = Field(default="", description="Default Google Gemini API key")
    GROQ_API_KEY: str = Field(default="", description="Default Groq API key")
    
    # Supabase Configuration
    SUPABASE_URL: str = Field(default="", description="Supabase project URL")
    SUPABASE_ANON_KEY: str = Field(default="", description="Supabase anon public key")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="", description="Supabase service role secret key")
    
    # Privacy / Compliance
    LOG_PAYLOADS: bool = Field(default=True, description="When False, prompt/completion text are redacted")
    
    # Routing defaults when client headers are omitted
    DEFAULT_MAX_BUDGET_USD: float = 0.05
    DEFAULT_MAX_LATENCY_SLA_MS: float = 5000.0
    DEFAULT_TIMEOUT_MS: int = 15000
    GLOBAL_REQUEST_TIMEOUT_MS: int = 30000

    model_config = ConfigDict(env_file=(".env", "backend/.env"), env_file_encoding="utf-8", extra="ignore")

settings = Settings()
