from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

# HTTPBearer automatically extracts the "Authorization: Bearer <token>" header
security_scheme = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    token = credentials.credentials
    try:
        # Decode the JWT using the secret key and HS256 algorithm
        payload = jwt.decode(
            token,
            settings.JWT_ACCESS_SECRET,
            algorithms=["HS256"]
        )
        
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject (sub)",
            )
            
        # Return dictionary mimicking NestJS validation return shape
        return {
            "userId": user_id,
            "email": email,
            "role": role
        }
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
        )
