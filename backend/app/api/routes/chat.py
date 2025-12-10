from fastapi import APIRouter
from app.models.chat_request import ChatRequest
from app.services.qwen_client import ask_qwen

router = APIRouter()

@router.post("/")
async def chat_endpoint(req: ChatRequest):
    answer = await ask_qwen(req.message, req.mode)
    return {"answer": answer}
