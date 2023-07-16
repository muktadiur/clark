import sys
from dotenv import load_dotenv
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)
from document_utils import process_documents
from document_conversation import DocumentConversation


def main(embeddings_to_use: str = None, model_name: str = None) -> None:
    conversation = DocumentConversation(
        embeddings_to_use=embeddings_to_use,
        model_name=model_name
    )
    texts = process_documents()
    chain: BaseConversationalRetrievalChain = conversation.get_chain(
        texts=texts
    )

    print("Welcome to the Clark!")
    print("(type 'exit' to quit)")

    while (True):
        query: str = input("You: ")

        if query.lower() in ["quit", "exit"] :
            break

        response: str = chain.run(query)
        print(f"Clark: {response}")


embeddings_to_use: str = sys.argv[1] if len(sys.argv) > 1 else None

if __name__ == '__main__':
    load_dotenv()
    main(
        embeddings_to_use=embeddings_to_use
    )
