import glob
import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request, UploadFile, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from auth.router import router as auth_router
from auth.security import get_user_from_token
from clark.helpers import get_chain, create_vectors
from core.logger import logger
from db.database import create_tables, get_db
from schemas.question import Question, File
from schemas.response import CompletionResponse, GenericResponse

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(auth_router)
templates = Jinja2Templates(directory="static")


def _get_current_user(request: Request, db: Session):
    token = request.cookies.get("access_token")
    if not token:
        return None
    return get_user_from_token(token, db)


@app.get("/")
async def index(request: Request, db: Session = Depends(get_db)):
    user = _get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(request, "index.html", {"user": user})


@app.get("/home")
async def home(request: Request):
    return templates.TemplateResponse(request, "home.html")


@app.get("/login", tags=["Auth"])
async def login(request: Request, db: Session = Depends(get_db)):
    if _get_current_user(request, db):
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse(request, "auth/login.html")


@app.get("/signup", tags=["Auth"])
async def signup(request: Request, db: Session = Depends(get_db)):
    if _get_current_user(request, db):
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse(request, "auth/signup.html")


@app.get("/favicon.ico")
async def favicon() -> FileResponse:
    file_path = Path("static/images") / "favicon.ico"
    return FileResponse(
        path=file_path,
        headers={"Content-Disposition": "attachment; filename=favicon.ico"},
    )


@app.get("/files", tags=["Files"])
async def files(request: Request, db: Session = Depends(get_db)) -> list[str]:
    if not _get_current_user(request, db):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return [f for f in glob.glob("data/*")]


@app.post("/upload_files", tags=["Files"])
async def upload_files(
    files: list[UploadFile],
    request: Request,
    db: Session = Depends(get_db),
) -> GenericResponse:
    if not _get_current_user(request, db):
        raise HTTPException(status_code=401, detail="Not authenticated")
    path = Path("data")
    for file in files:
        file_path = path / file.filename
        with open(file_path, "wb") as f:
            f.write(await file.read())
    return GenericResponse(status="success")


@app.post("/delete_file/", tags=["Files"])
async def delete_file(
    file: File,
    request: Request,
    db: Session = Depends(get_db),
) -> GenericResponse:
    if not _get_current_user(request, db):
        raise HTTPException(status_code=401, detail="Not authenticated")
    if os.path.exists(file.file_name):
        try:
            os.remove(file.file_name)
            logger.info(f"File {file.file_name} deleted successfully")
            return GenericResponse(status="success")
        except OSError as e:
            logger.error(f"Error deleting file {file.file_name}: {str(e)}")
            raise HTTPException(status_code=500, detail="Error deleting file")
    logger.warning(f"File {file.file_name} not found")
    raise HTTPException(status_code=404, detail="File not found")


@app.post("/process/", tags=["LLM"])
async def process_files(
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
) -> GenericResponse:
    if not _get_current_user(request, db):
        raise HTTPException(status_code=401, detail="Not authenticated")
    background_tasks.add_task(create_vectors)
    logger.info("Processing files")
    return GenericResponse(status="success")


@app.post("/completions/", tags=["LLM"])
async def completions(
    question: Question,
    request: Request,
    db: Session = Depends(get_db),
) -> CompletionResponse:
    if not _get_current_user(request, db):
        raise HTTPException(status_code=401, detail="Not authenticated")
    chain = get_chain()
    result = chain.invoke({"question": question.message})
    content = result["answer"]
    logger.info(f"Response: {content}")
    return CompletionResponse(content=content)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
