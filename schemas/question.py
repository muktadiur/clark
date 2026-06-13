from pydantic import BaseModel


class Question(BaseModel):
    message: str
    conversation_id: int | None = None
    model: str | None = None


class File(BaseModel):
    file_name: str
