# app/api/routes/code.py

from fastapi import APIRouter
from pydantic import BaseModel
from app.services.sandbox import run_in_sandbox
from app.services.qwen_client import ask_qwen
from app.services.memory import memory  # ← ПРАВИЛЬНЫЙ ИМПОРТ

router = APIRouter()

class CodeRequest(BaseModel):
    code: str
    task_id: str

@router.post("/run")
async def run_code(req: CodeRequest):
    """Запускает код в sandbox и возвращает feedback"""
    
    sandbox_result = run_in_sandbox(req.code, req.task_id)
    memory.stage = "feedback"
    feedback_response = await ask_qwen("", "TECH", code_result=sandbox_result)
    
    if isinstance(feedback_response, dict):
        llm_feedback = feedback_response.get("answer", "")
        next_task = feedback_response.get("next_task")
        is_final = feedback_response.get("is_final", False)
    else:
        llm_feedback = str(feedback_response) if feedback_response else ""
        next_task = None
        is_final = False
    
    return {
        "success": sandbox_result["success"],
        "results": sandbox_result["results"],
        "llm_feedback": llm_feedback,
        "next_task": next_task,
        "is_final": is_final
    }
