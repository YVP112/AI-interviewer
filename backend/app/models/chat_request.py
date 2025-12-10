from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    mode: str = "HR"
