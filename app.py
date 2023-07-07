from typing import List
from dotenv import load_dotenv

from langchain.schema import Document
from langchain.vectorstores import FAISS
from langchain.document_loaders import PyPDFDirectoryLoader, DirectoryLoader

from langchain.embeddings import OpenAIEmbeddings, HuggingFaceInstructEmbeddings
from langchain.chat_models import ChatOpenAI

from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain


def get_vector_store(documents: List[Document]) -> FAISS:
    embeddings = OpenAIEmbeddings()
    # embeddings = HuggingFaceInstructEmbeddings(model_name='hkunlp/instructor-xl')
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
    loader = DirectoryLoader('data/csv/')
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
        response: str = chain.run(query)
        print(f"Clark: {response}")
        if query.lower() == "exit":
            break
    

if __name__ == '__main__':
    main()
