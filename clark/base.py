import os
import pickle
from abc import ABC, abstractmethod, abstractproperty

import faiss
from langchain import FAISS
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)


class BaseConversation(ABC):

    @abstractproperty
    def default_model(self) -> str:
        pass

    @abstractproperty
    def embeddings(self):
        pass

    @abstractmethod
    def get_conversation_chain(
        self,
        store: FAISS
    ) -> BaseConversationalRetrievalChain:
        pass

    def create_store(self, texts: list):
        """Create a vector store from the provided texts."""

        store: FAISS = FAISS.from_texts(
            texts=texts,
            embedding=self.embeddings
        )
        faiss.write_index(store.index, "docs.index")
        store.index = None
        with open("faiss_store.pkl", "wb") as f:
            pickle.dump(store, f)

    def get_chain(self) -> BaseConversationalRetrievalChain:
        """Create a conversation chain from the stored vector store."""

        if not os.path.exists("docs.index"):
            raise FileNotFoundError("No vector store found.")
        if not os.path.exists("faiss_store.pkl"):
            raise FileNotFoundError("No vector store found.")

        index = faiss.read_index("docs.index")
        with open("faiss_store.pkl", "rb") as f:
            store = pickle.load(f)

        store.index = index
        return self.get_conversation_chain(
            store=store
        )
