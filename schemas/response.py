from pydantic import BaseModel


class CompletionResponse(BaseModel):
    content: str
    conversation_id: int


class GenericResponse(BaseModel):
    status: str
