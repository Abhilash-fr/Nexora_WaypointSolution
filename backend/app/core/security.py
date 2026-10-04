import os

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8
