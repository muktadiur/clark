import os
import pickle
from abc import ABC, abstractmethod

import faiss
from langchain_community.vectorstores import FAISS
from langchain_core.runnables.base import Runnable


class BaseConversation(ABC):

    @property
    @abstractmethod
    def default_model(self) -> str:
        pass

    @property
    @abstractmethod
    def embeddings(self):
        pass

    @abstractmethod
    def get_conversation_chain(self, store: FAISS) -> Runnable:
        pass

    def create_store(self, texts: list):
        store: FAISS = FAISS.from_texts(texts=texts, embedding=self.embeddings)
        faiss.write_index(store.index, "docs.index")
        store.index = None
        with open("faiss_store.pkl", "wb") as f:
            pickle.dump(store, f)

    def get_chain(self) -> Runnable:
        if not os.path.exists("docs.index"):
            raise FileNotFoundError("No vector store found.")
        if not os.path.exists("faiss_store.pkl"):
            raise FileNotFoundError("No vector store found.")

        index = faiss.read_index("docs.index")
        with open("faiss_store.pkl", "rb") as f:
            store = pickle.load(f)

        store.index = index
        return self.get_conversation_chain(store=store)
