import sys
from langchain.vectorstores import FAISS
from langchain.chat_models import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)
from langchain.embeddings.base import Embeddings
from langchain.embeddings import (
    OpenAIEmbeddings,
    HuggingFaceInstructEmbeddings
)

from utils import get_texts, get_documents


embeddings_to_use: str = sys.argv[1] if len(sys.argv) > 1 else None


def get_embeddings() -> Embeddings:
    if embeddings_to_use in ['hf', 'huggingface']:
        return HuggingFaceInstructEmbeddings(
            model_name='hkunlp/instructor-xl'
        )
    return OpenAIEmbeddings()


def get_vector_store(
        texts: list[str]
) -> FAISS:
    embeddings: Embeddings = get_embeddings()
    return FAISS.from_texts(
        texts=texts,
        embedding=embeddings
    )


def get_conversation_chain(
        vector_store: FAISS
) -> BaseConversationalRetrievalChain:
    llm = ChatOpenAI()
    memory = ConversationBufferMemory(
        memory_key='chat_history',
        return_messages=True
    )
    return ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vector_store.as_retriever(),
        memory=memory
    )


def get_chain() -> BaseConversationalRetrievalChain:
    texts = get_texts(get_documents())
    vector_store: FAISS = get_vector_store(
        texts=texts
    )

    return get_conversation_chain(
        vector_store=vector_store
    )
