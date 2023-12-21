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


@mock.patch("app.create_vectors")
def test_process_files(create_vectors) -> None:
    create_vectors.return_value = ["text1", "text2", "text3"]

    response = client.post("/process/")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    create_vectors.assert_called_once()


@mock.patch("app.get_chain")
def test_completions(mock_get_chain) -> None:
    mock_chain = mock.Mock()
    mock_chain.run.return_value = "Canada's capital is Ottawa"
    mock_get_chain.return_value = mock_chain

    question = {"message": "Capital of Canada?"}
    response = client.post("/completions/", json=question)
    assert response.status_code == 200
    assert "content" in response.json()
    assert response.json()["content"] == "Canada's capital is Ottawa"

    mock_chain.run.assert_called_once_with(question["message"])
