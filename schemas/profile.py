from pydantic import BaseModel


class ProfileIn(BaseModel):
    display_name: str | None = None
    username: str | None = None


class ProfileOut(BaseModel):
    email: str
    display_name: str | None = None
    username: str | None = None
    name: str  # resolved label (display_name or email local-part)
    initials: str
