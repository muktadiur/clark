from langchain.chat_models import ChatOpenAI
from langchain.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.embeddings.base import Embeddings
from langchain.embeddings import (
    OpenAIEmbeddings,
    HuggingFaceInstructEmbeddings
)
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)


class DocumentConversation:

    def __init__(
        self,
        embeddings_to_use: str = None,
        model_name: str = None
    ) -> None:
        self.embeddings: Embeddings = self.get_embeddings(
            embeddings_to_use=embeddings_to_use,
            model_name=model_name
        )

    def get_embeddings(
        self,
        embeddings_to_use: str,
        model_name: str
    ) -> Embeddings:
        if embeddings_to_use in ['hf', 'huggingface']:
            return HuggingFaceInstructEmbeddings(
                model_name=model_name or 'hkunlp/instructor-xl'
            )
        return OpenAIEmbeddings(
            model=model_name or 'text-embedding-ada-002'
        )

    def get_vector_store(self, texts: list) -> FAISS:
        return FAISS.from_texts(
            texts=texts,
            embedding=self.embeddings
        )

    def get_conversation_chain(
        self,
        vector_store: FAISS
    ) -> BaseConversationalRetrievalChain:
        llm = ChatOpenAI()
        memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )
        return ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=vector_store.as_retriever(),
            memory=memory
        )

    def get_chain(self, texts: list) -> BaseConversationalRetrievalChain:
        vector_store: FAISS = self.get_vector_store(texts=texts)
        return self.get_conversation_chain(
            vector_store=vector_store
        )
