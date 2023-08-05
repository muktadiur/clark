from typing import Optional

from langchain.chat_models import ChatOpenAI
from langchain.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.embeddings.base import Embeddings
from langchain.embeddings import OpenAIEmbeddings
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)

from clark.base import BaseConversation


class OpenAIConversation(BaseConversation):

    def __init__(self, model_name: Optional[str] = None) -> None:
        self.model_name = model_name
        self._embeddings: Optional[Embeddings] = None

    @property
    def default_model(self) -> str:
        return 'text-embedding-ada-002'

    @property
    def embeddings(self) -> Embeddings:
        if self._embeddings is None:
            self._embeddings = OpenAIEmbeddings(
                model=self.model_name or self.default_model
            )
        return self._embeddings

    def get_vector_store(self, texts: list) -> FAISS:
        """Create a vector store from the provided texts."""

        return FAISS.from_texts(
            texts=texts,
            embedding=self.embeddings
        )

    def get_conversation_chain(
        self,
        vector_store: FAISS
    ) -> BaseConversationalRetrievalChain:
        """Create a conversation chain from the provided vector store."""

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
