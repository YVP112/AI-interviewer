from fastapi import APIRouter
from app.services.memory import memory

router = APIRouter()

@router.post("/")
def reset_chat():
    memory.reset_full()
    return {"status": "ok"}
