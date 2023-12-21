from pydantic import BaseModel


class Question(BaseModel):
    message: str


class File(BaseModel):
    file_name: str

