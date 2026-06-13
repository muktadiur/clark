from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import app
from db.database import Base, get_db

# Tests run against an isolated in-memory database, never clark.db.
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


def _override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db

client = TestClient(app)


def test_home() -> None:
    response = client.get("/home")
    assert response.status_code == 200
    assert "Clark" in response.text


def test_files() -> None:
    response = client.get("/files")
    assert response.status_code == 401


@mock.patch("app.create_vectors")
def test_process_files(create_vectors) -> None:
    create_vectors.return_value = ["text1", "text2", "text3"]

    response = client.post("/process/")
    assert response.status_code == 401


@mock.patch("app.get_chain")
def test_completions(mock_get_chain) -> None:
    mock_chain = mock.Mock()
    mock_chain.invoke.return_value = {"answer": "Canada's capital is Ottawa"}
    mock_get_chain.return_value = mock_chain

    question = {"message": "Capital of Canada?"}
    response = client.post("/completions/", json=question)
    assert response.status_code == 401


def test_conversations_require_auth() -> None:
    assert client.get("/conversations").status_code == 401
    assert client.get("/conversations/1").status_code == 401
    assert client.delete("/conversations/1").status_code == 401


@mock.patch("app.get_chain")
def test_conversation_flow(mock_get_chain) -> None:
    mock_chain = mock.Mock()
    mock_chain.invoke.return_value = {"answer": "Canada's capital is Ottawa"}
    mock_get_chain.return_value = mock_chain

    auth_client = TestClient(app)
    credentials = {"email": "flow-test@example.com", "password": "secret123"}
    assert auth_client.post("/auth/signup", json=credentials).status_code == 200
    assert auth_client.post("/auth/login", json=credentials).status_code == 200

    # First message creates a conversation titled after the question.
    response = auth_client.post(
        "/completions/", json={"message": "Capital of Canada?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Canada's capital is Ottawa"
    conversation_id = data["conversation_id"]

    # Follow-up message lands in the same conversation.
    response = auth_client.post(
        "/completions/",
        json={"message": "And its population?", "conversation_id": conversation_id},
    )
    assert response.json()["conversation_id"] == conversation_id

    conversations = auth_client.get("/conversations").json()
    assert [c["id"] for c in conversations] == [conversation_id]
    assert conversations[0]["title"] == "Capital of Canada?"

    messages = auth_client.get(f"/conversations/{conversation_id}").json()
    assert [m["role"] for m in messages] == ["user", "assistant", "user", "assistant"]
    assert messages[0]["content"] == "Capital of Canada?"

    # Deleting removes the conversation and its messages.
    assert auth_client.delete(f"/conversations/{conversation_id}").status_code == 200
    assert auth_client.get(f"/conversations/{conversation_id}").status_code == 404
    assert auth_client.get("/conversations").json() == []
