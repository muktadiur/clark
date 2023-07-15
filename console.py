from dotenv import load_dotenv
from document_chat import get_chain
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)


def main() -> None:
    print("Welcome to the Clark!")
    print("(type 'exit' to quit)")

    chain: BaseConversationalRetrievalChain = get_chain()

    while (True):
        query: str = input("You: ")

        if query.lower() == "exit":
            break

        response: str = chain.run(query)
        print(f"Clark: {response}")


if __name__ == '__main__':
    load_dotenv()
    main()
