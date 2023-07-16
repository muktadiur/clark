from unittest import mock
from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_home() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Clark" in response.text


def test_files() -> None:
    response = client.get("/files")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@mock.patch("app.process_documents")
def test_process_files(mock_process_documents) -> None:
    mock_process_documents.return_value = ["text1", "text2", "text3"]

    response = client.post("/process/")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    mock_process_documents.assert_called_once()


@mock.patch("app.chain")
def test_ask(mock_chain) -> None:
    mock_chain.run.return_value = "Canada's capital is Ottawa"

    question = {"message": "Capital of Canada?"}
    response = client.post("/ask/", json=question)
    assert response.status_code == 200
    assert "content" in response.json()
    assert response.json()["content"] == "Canada's capital is Ottawa"

    mock_chain.run.assert_called_once_with(question["message"])
