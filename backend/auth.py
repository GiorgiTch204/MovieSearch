from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY="API_GOES_HERE"
ALGORITHM="HS256"

def create_access_token(data: dict):
    to_encode=data.copy()

    expire=datetime.utcnow()+timedelta(minutes=30)
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)