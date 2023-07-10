from typing import List
from langchain.schema import Document
from langchain.document_loaders import PyPDFDirectoryLoader, DirectoryLoader


def get_pdf_documents() -> List[Document]:
    loader = PyPDFDirectoryLoader('data/')
    documents: List[Document] = loader.load()
    return documents


def get_others_documents(glob: str) -> List[Document]:
    loader = DirectoryLoader('data/', glob=glob)
    documents: List[Document] = loader.load()
    return documents


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
