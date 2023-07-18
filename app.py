import sys
import glob
import uvicorn
from pathlib import Path
from fastapi import FastAPI, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from document.utils import process_documents
from document.conversation import DocumentConversation

app = FastAPI()
app.mount("/static", StaticFiles(directory="templates"), name="static")
templates = Jinja2Templates(directory="templates")

load_dotenv()

chain = None

embeddings_to_use: str = sys.argv[1] if len(sys.argv) > 1 else None


class Question(BaseModel):
    message: str


@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )


@app.get('/favicon.ico')
async def favicon() -> FileResponse:
    path = Path("images")
    file_path = path / "favicon.ico"
    return FileResponse(
        path=file_path,
        headers={"Content-Disposition": "attachment; filename=favicon.ico"}
    )


@app.get("/files")
async def files() -> list[str]:
    return [f for f in glob.glob("data/*")]


@app.post("/uploadfiles")
async def uploadfiles(files: list[UploadFile]) -> dict[str, str]:
    path = Path("data")
    for file in files:
        file_path = path / file.filename
        with open(file_path, 'wb') as f:
            f.write(await file.read())

    return {"status": "success"}


@app.post("/process/")
async def process_files() -> dict[str, str]:
    global chain

    conversation = DocumentConversation(
        embeddings_to_use=embeddings_to_use
    )
    texts = process_documents()
    chain = conversation.get_chain(texts=texts)

    return {"status": "success"}


@app.post("/ask/")
async def ask(question: Question) -> dict[str, str]:
    return {"content": chain.run(question.message)}


if __name__ == "__main__":
    uvicorn.run(host="0.0.0.0", port=8000, app=app)
