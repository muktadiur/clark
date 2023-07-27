from enum import Enum
from typing import Optional

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


class EmbeddingsToUse(Enum):
    HUGGINGFACE = 'huggingface'
    OPENAI = 'openai'


class DocumentConversation:

    DEFAULT_HUGGINGFACE_MODEL = 'hkunlp/instructor-xl'
    DEFAULT_OPENAI_MODEL = 'text-embedding-ada-002'

    def __init__(
        self,
        embeddings_to_use: Optional[str] = None,
        model_name: Optional[str] = None
    ) -> None:
        self.embeddings_to_use = embeddings_to_use
        self.model_name = model_name
        self._embeddings: Optional[Embeddings] = None

    @property
    def embeddings(self) -> Embeddings:
        if self._embeddings is None:
            self._embeddings = self.get_embeddings(
                embeddings_to_use=self.embeddings_to_use,
                model_name=self.model_name
            )
        return self._embeddings

    def get_embeddings(
        self,
        embeddings_to_use: Optional[str],
        model_name: Optional[str]
    ) -> Embeddings:
        """Get embeddings based on the provided parameters."""
        if embeddings_to_use is None or embeddings_to_use.lower() == EmbeddingsToUse.OPENAI.value:
            return OpenAIEmbeddings(
                model=model_name or self.DEFAULT_OPENAI_MODEL
            )

        if embeddings_to_use.lower() == EmbeddingsToUse.HUGGINGFACE.value:
            return HuggingFaceInstructEmbeddings(
                model_name=model_name or self.DEFAULT_HUGGINGFACE_MODEL
            )

        raise ValueError(f"embeddings_to_use '{embeddings_to_use}' not recognized.")

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

    def get_chain(self, texts: list) -> BaseConversationalRetrievalChain:
        """Create a conversation chain from the provided texts."""
        vector_store: FAISS = self.get_vector_store(texts=texts)
        return self.get_conversation_chain(
            vector_store=vector_store
        )
