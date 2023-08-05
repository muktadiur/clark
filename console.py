from dotenv import load_dotenv
from langchain.chains.conversational_retrieval.base import (
    BaseConversationalRetrievalChain
)
from clark.helpers import get_chain


def main() -> None:
    chain: BaseConversationalRetrievalChain = get_chain()

    print("Welcome to the Clark!")
    print("(type 'exit' to quit)")

    while (True):
        query: str = input("You: ")

        if query.lower() in ["quit", "exit"]:
            break

        response: str = chain.run(query)
        print(f"Clark: {response}")


if __name__ == '__main__':
    load_dotenv()
    main()
