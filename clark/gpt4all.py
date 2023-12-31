import os
from typing import Optional

from langchain import FAISS
from langchain.chains import ConversationalRetrievalChain
# from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)
from langchain.embeddings import GPT4AllEmbeddings
from langchain.embeddings.base import Embeddings
from langchain.llms import GPT4All
from langchain.memory import ConversationBufferMemory

from clark.base import BaseConversation


class GPT4AllConversation(BaseConversation):

    def __init__(self, model_name: Optional[str] = None) -> None:
        self.model_name = model_name
        self._embeddings: Optional[Embeddings] = None

    @property
    def default_model(self) -> str:
        return os.getenv("GPT4ALL_MODEL_PATH")

    @property
    def embeddings(self) -> Embeddings:
        if self._embeddings is None:
            self._embeddings = GPT4AllEmbeddings(
                model=self.model_name or self.default_model
            )
        return self._embeddings

    def get_conversation_chain(
        self,
        store: FAISS
    ) -> BaseConversationalRetrievalChain:
        """Create a conversation chain from the provided vector store."""

        llm = GPT4All(
            model=self.default_model,
            # callbacks=[StreamingStdOutCallbackHandler()],
            n_threads=8,
            embedding=True
        )

        memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )
        return ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=store.as_retriever(),
            memory=memory
        )
