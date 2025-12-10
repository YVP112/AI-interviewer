from fastapi import FastAPI
from app.api.routes import chat, health, mode, reset, tasks, code

app = FastAPI(title="Interviewer AI Backend")

app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(mode.router, prefix="/mode", tags=["Mode"])
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(code.router, prefix="/code", tags=["Code"])
app.include_router(reset.router, prefix="/reset", tags=["Reset"])
app.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
