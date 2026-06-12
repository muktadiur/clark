from typing import Optional

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import HuggingFaceHub
from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables.base import Runnable

from clark.base import BaseConversation

_PROMPT = ChatPromptTemplate.from_template(
    "Use the following context to answer the question. "
    "If you don't know the answer, say you don't know.\n\n"
    "Context: {context}\n\nQuestion: {question}"
)


def _format_docs(docs) -> str:
    return "\n\n".join(d.page_content for d in docs)


class HFConversation(BaseConversation):

    def __init__(self, model_name: Optional[str] = None) -> None:
        self.model_name = model_name
        self._embeddings: Optional[Embeddings] = None

    @property
    def default_model(self) -> str:
        return "hkunlp/instructor-large"

    @property
    def embeddings(self) -> Embeddings:
        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings()
        return self._embeddings

    def get_conversation_chain(self, store: FAISS) -> Runnable:
        retriever = store.as_retriever()
        llm = HuggingFaceHub(
            repo_id="google/flan-t5-xxl",
            model_kwargs={"temperature": 0.1, "max_length": 512},
        )
        return (
            RunnablePassthrough.assign(
                context=lambda x: _format_docs(retriever.invoke(x["question"]))
            )
            | RunnablePassthrough.assign(answer=_PROMPT | llm | StrOutputParser())
        )
