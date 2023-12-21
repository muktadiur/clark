import os
from typing import List

from langchain.document_loaders import (
    PyPDFDirectoryLoader,
    DirectoryLoader
)
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

DATA_DIRECTORY = 'data/'
FILE_GLOBS = [
    "**/[!.]*.doc",
    "**/[!.]*.docx",
    "**/[!.]*.csv",
    "**/[!.]*.txt"
]


def load_documents(directory: str, glob: str = None) -> List[Document]:
    """
    Loads documents from a directory.

    If a glob is provided, use a generic DirectoryLoader,
    otherwise use a specific PyPDFDirectoryLoader.
    """
    if glob:
        loader = DirectoryLoader(directory, glob=glob)
    else:
        loader = PyPDFDirectoryLoader(directory)

    return loader.load()


def get_documents() -> List[Document]:
    """
    Load all documents of various formats from the data directory.
    """
    documents = load_documents(DATA_DIRECTORY)
    for glob in FILE_GLOBS:
        documents.extend(load_documents(DATA_DIRECTORY, glob=glob))

    return documents


def get_texts(
    documents: List[Document],
    text_splitter: RecursiveCharacterTextSplitter
) -> List[str]:
    """
    Splits the content of the documents into chunks using
    a given text splitter.
    """
    return [
        chunk
        for document in documents
        for chunk in text_splitter.split_text(document.page_content)
    ]


def process_documents() -> List[str]:
    """
    Process all documents in the data directory and
    return their content as chunks of text.
    """
    text_splitter = RecursiveCharacterTextSplitter(
        separators=[" ", ",", "\n"],
        chunk_size=int(os.getenv("CHUNK_SIZE", 2000)),
        chunk_overlap=int(os.getenv("CHUNK_OVERLAP", 100)),
        length_function=len
    )
    documents: List[Document] = get_documents()
    return get_texts(documents, text_splitter)
