import os
from fastapi import FastAPI, UploadFile
from dotenv import load_dotenv
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)
from document_utils import process_documents
from document_conversation import DocumentConversation

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

    conversation = DocumentConversation()
    texts = process_documents()
    chain = conversation.get_chain(texts=texts)

    return {"status": "sucess"}


@app.post("/ask/")
async def ask(message: str) -> dict[str, str]:
    return {"result": chain.run(message)}
