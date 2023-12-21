import glob
import os
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import (
    FastAPI, Request, UploadFile,
    HTTPException, BackgroundTasks
)
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from schemas.response import CompletionResponse, GenericResponse
from schemas.question import Question, File
from core.logger import logger
from clark.helpers import get_chain, create_vectors

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="static")

load_dotenv()


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )


@app.get("/home")
async def home(request: Request):
    return templates.TemplateResponse(
        "home.html",
        {"request": request}
    )


@app.get("/login", tags=["Auth"])
async def login(request: Request):
    return templates.TemplateResponse(
        "auth/login.html",
        {"request": request}
    )


@app.get("/signup", tags=["Auth"])
async def signup(request: Request):
    return templates.TemplateResponse(
        "auth/signup.html",
        {"request": request}
    )


@app.get('/favicon.ico')
async def favicon() -> FileResponse:
    path = Path("static/images")
    file_path = path / "favicon.ico"
    return FileResponse(
        path=file_path,
        headers={"Content-Disposition": "attachment; filename=favicon.ico"}
    )


@app.get("/files", tags=["Files"])
async def files() -> list[str]:
    return [f for f in glob.glob("data/*")]


@app.post("/upload_files", tags=["Files"])
async def upload_files(files: list[UploadFile]) -> GenericResponse:
    path = Path("data")
    for file in files:
        file_path = path / file.filename
        with open(file_path, 'wb') as f:
            f.write(await file.read())

    return GenericResponse(status="success")


@app.post("/delete_file/", tags=["Files"], responses={
    200: {"description": "File deleted successfully"},
    404: {"description": "File not found"}
})
async def delete_file(file: File) -> GenericResponse:
    if os.path.exists(file.file_name):
        try:
            os.remove(file.file_name)
            logger.info(f"File {file.file_name} deleted successfully")
            return GenericResponse(status="success")
        except OSError as e:
            logger.error(f"Error deleting file {file.file_name}: {str(e)}")
            raise HTTPException(status_code=500, detail="Error deleting file")
    else:
        logger.warning(f"File {file.file_name} not found")
        raise HTTPException(status_code=404, detail="File not found")


@app.post("/process/", tags=["LLM"])
async def process_files(background_tasks: BackgroundTasks) -> GenericResponse:
    background_tasks.add_task(create_vectors)
    logger.info("Processing files")
    return GenericResponse(status="success")


@app.post("/completions/", tags=["LLM"])
async def completions(question: Question) -> CompletionResponse:
    chain = get_chain()
    content = chain.run(question.message)
    logger.info(f"Response: {content}")
    return CompletionResponse(content=content)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
