from pathlib import Path

from dotenv import load_dotenv


BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def load_environment() -> None:
    load_dotenv(BACKEND_ENV_FILE, override=False)


load_environment()