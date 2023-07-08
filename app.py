import sys
from typing import List
from dotenv import load_dotenv

from langchain.schema import Document
from langchain.vectorstores import FAISS
from langchain.document_loaders import PyPDFDirectoryLoader, DirectoryLoader
from langchain.embeddings.base import Embeddings
from langchain.embeddings import OpenAIEmbeddings, HuggingFaceInstructEmbeddings
from langchain.chat_models import ChatOpenAI

from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain

embeddings_to_use: str = sys.argv[1] if len(sys.argv) > 1 else None

def get_embeddings() -> Embeddings:
    if embeddings_to_use in ['hf', 'huggingface']:
        return HuggingFaceInstructEmbeddings(model_name='hkunlp/instructor-xl')
    return OpenAIEmbeddings()

def get_vector_store(documents: List[Document]) -> FAISS:
    embeddings: Embeddings = get_embeddings()
    vector_store: FAISS = FAISS.from_documents(
        documents=documents,
        embedding=embeddings
    )
    return vector_store

def get_conversation_chain(vector_store: FAISS):
    llm = ChatOpenAI()
    memory = ConversationBufferMemory(
        memory_key='chat_history',
        return_messages=True
    )
    chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vector_store.as_retriever(),
        memory=memory
    )
    return chain

def get_pdf_documents() -> List[Document]:
    loader = PyPDFDirectoryLoader('data/pdf/')
    documents: List[Document] = loader.load()
    return documents

def get_csv_documents() -> List[Document]:
    loader = DirectoryLoader('data/csv/', glob="**/[!.]*.csv")
    documents: List[Document] = loader.load()
    return documents

def main() -> None:
    load_dotenv()
    pdf_documents: List[Document] = get_pdf_documents()
    csv_documents: List[Document] = get_csv_documents()

    vector_store: FAISS = get_vector_store(
        documents=pdf_documents + csv_documents
    )

    chain = get_conversation_chain(
        vector_store=vector_store
    )

    print("Welcome to the Clark!")
    print("(type 'exit' to quit)")
    while(True):
        query: str = input("You: ")

        if query.lower() == "exit":
            break

        response: str = chain.run(query)
        print(f"Clark: {response}")

if __name__ == '__main__':
    main()
