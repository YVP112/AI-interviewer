from fastapi import APIRouter, HTTPException
from app.services.tasks import TASKS, get_task, random_task

router = APIRouter()

@router.get("/list")
def list_tasks():
    """Вернуть список всех задач"""
    return [
        {"task_id": tid, "title": data["title"], "description": data["description"]}
        for tid, data in TASKS.items()
    ]

@router.get("/random")
def random_task_route():
    """Вернуть случайную задачу"""
    tid = random_task()
    task = get_task(tid)
    return {
        "task_id": tid,
        "title": task["title"],
        "description": task["description"],
        "template": task["template"],
    }

@router.get("/{task_id}")
def get_task_route(task_id: str):
    """Вернуть задачу по ID"""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Unknown task_id")
    
    return {
        "task_id": task_id,
        "title": task["title"],
        "description": task["description"],
        "template": task["template"],
    }
