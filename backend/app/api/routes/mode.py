from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ModeRequest(BaseModel):
    mode: str

current_mode = "HR"

@router.post("/")
def set_mode(req: ModeRequest):
    global current_mode
    current_mode = req.mode
    return {"mode_set_to": current_mode}
