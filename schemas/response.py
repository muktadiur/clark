from pydantic import BaseModel


class CompletionResponse(BaseModel):
    content: str


class GenericResponse(BaseModel):
    status: str
