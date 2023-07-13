from typing import List
from langchain.schema import Document
from langchain.text_splitter import CharacterTextSplitter
from langchain.document_loaders import (
    PyPDFDirectoryLoader,
    DirectoryLoader
)


def get_pdf_documents() -> List[Document]:
    loader = PyPDFDirectoryLoader('data/')
    return loader.load()


def get_others_documents(glob: str) -> List[Document]:
    loader = DirectoryLoader('data/', glob=glob)
    return loader.load()


def get_documents() -> List[Document]:
    documents: List[Document] = get_pdf_documents()
    globs: list[str] = [
        "**/[!.]*.doc",
        "**/[!.]*.docx",
        "**/[!.]*.csv",
        "**/[!.]*.txt"
    ]
    for glob in globs:
        documents.extend(get_others_documents(glob=glob))

    return documents


def get_texts(documents):
    chunks = []
    text_splitter = CharacterTextSplitter(
        separator="\n",
        chunk_size=500,
        chunk_overlap=100,
        length_function=len
    )

    for document in documents:
        texts: List[str] = text_splitter.split_text(
            document.page_content
        )
        chunks.extend(texts)
    return chunks
