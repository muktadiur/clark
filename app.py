import os
from fastapi import FastAPI, UploadFile
from dotenv import load_dotenv
from document_chat import get_chain
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)


app = FastAPI()

load_dotenv()

chain: BaseConversationalRetrievalChain = None


@app.post("/uploadfiles")
async def upload_files(files: list[UploadFile]) -> dict[str, str]:
    for file in files:
        file_path = os.path.join("data", file.filename)
        with open(file_path, "wb") as f:
            f.write(file.file.read())
    return {"status: ": "sucess"}


@app.post("/process/")
async def process_files() -> dict[str, str]:
    global chain
    chain = get_chain()
    return {"status": "sucess"}


@app.post("/ask/")
async def ask(message: str) -> dict[str, str]:
    return {"result": chain.run(message)}
