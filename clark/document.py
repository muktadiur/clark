import os
from typing import List

from langchain_community.document_loaders import DirectoryLoader, PyPDFDirectoryLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

DATA_DIRECTORY = "data/"
FILE_GLOBS = [
    "**/[!.]*.doc",
    "**/[!.]*.docx",
    "**/[!.]*.csv",
    "**/[!.]*.txt",
]


def load_documents(directory: str, glob: str = None) -> List[Document]:
    if glob:
        loader = DirectoryLoader(directory, glob=glob)
    else:
        loader = PyPDFDirectoryLoader(directory)
    return loader.load()


def get_documents() -> List[Document]:
    documents = load_documents(DATA_DIRECTORY)
    for glob in FILE_GLOBS:
        documents.extend(load_documents(DATA_DIRECTORY, glob=glob))
    return documents


def get_texts(
    documents: List[Document],
    text_splitter: RecursiveCharacterTextSplitter,
) -> List[str]:
    return [
        chunk
        for document in documents
        for chunk in text_splitter.split_text(document.page_content)
    ]


def process_documents() -> List[str]:
    text_splitter = RecursiveCharacterTextSplitter(
        separators=[" ", ",", "\n"],
        chunk_size=int(os.getenv("CHUNK_SIZE", 2000)),
        chunk_overlap=int(os.getenv("CHUNK_OVERLAP", 100)),
        length_function=len,
    )
    documents: List[Document] = get_documents()
    return get_texts(documents, text_splitter)
