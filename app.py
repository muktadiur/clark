from dotenv import load_dotenv
from chat import get_chain


def main() -> None:
    print("Welcome to the Clark!")
    print("(type 'exit' to quit)")
    while (True):
        query: str = input("You: ")

        if query.lower() == "exit":
            break

        response: str = get_chain().run(query)
        print(f"Clark: {response}")


if __name__ == '__main__':
    load_dotenv()
    main()
