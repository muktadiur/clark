from typing import Optional

from langchain_anthropic import ChatAnthropic
from langchain_community.embeddings import HuggingFaceEmbeddings
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


class ClaudeConversation(BaseConversation):

    def __init__(
        self, model_name: Optional[str] = None, api_key: Optional[str] = None
    ) -> None:
        self.model_name = model_name
        self.api_key = api_key
        self._embeddings: Optional[Embeddings] = None

    @property
    def default_model(self) -> str:
        return "claude-opus-4-8"

    @property
    def embeddings(self) -> Embeddings:
        # Anthropic has no embeddings endpoint; embed locally so the Claude
        # backend works with just an Anthropic API key.
        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings()
        return self._embeddings

    def get_conversation_chain(self, store: FAISS) -> Runnable:
        retriever = store.as_retriever()
        kwargs = {"api_key": self.api_key} if self.api_key else {}
        llm = ChatAnthropic(model=self.model_name or self.default_model, **kwargs)
        return (
            RunnablePassthrough.assign(
                context=lambda x: _format_docs(retriever.invoke(x["question"]))
            )
            | RunnablePassthrough.assign(answer=_PROMPT | llm | StrOutputParser())
        )
