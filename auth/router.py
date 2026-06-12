from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from auth.security import create_access_token, hash_password, verify_password
from db.database import get_db
from db.models import User
from schemas.auth import UserCreate, UserLogin
from schemas.response import GenericResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup")
async def signup(user_data: UserCreate, db: Session = Depends(get_db)) -> GenericResponse:
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
    )
    db.add(user)
    db.commit()
    return GenericResponse(status="success")


@router.post("/login")
async def login(user_data: UserLogin, db: Session = Depends(get_db)) -> GenericResponse:
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token(user.email)
    response = GenericResponse(status="success")
    from fastapi.responses import JSONResponse
    json_response = JSONResponse(content={"status": "success"})
    json_response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=86400,
        samesite="lax",
    )
    return json_response


@router.get("/logout")
async def logout():
    response = RedirectResponse(url="/home", status_code=status.HTTP_302_FOUND)
    response.delete_cookie("access_token")
    return response
