from abc import ABC, abstractmethod, abstractproperty
from langchain import FAISS
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)


class BaseConversation(ABC):

    @abstractproperty
    def default_model(self) -> str:
        pass

    @abstractmethod
    def get_vector_store(self, texts: list) -> FAISS:
        pass

    @abstractmethod
    def get_conversation_chain(
        self,
        vector_store: FAISS
    ) -> BaseConversationalRetrievalChain:
        pass

    def get_chain(self, texts: list) -> BaseConversationalRetrievalChain:
        """Create a conversation chain from the provided texts."""

        vector_store: FAISS = self.get_vector_store(texts=texts)
        return self.get_conversation_chain(
            vector_store=vector_store
        )
