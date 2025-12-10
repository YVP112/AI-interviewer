# app/services/qwen_client.py

import os
import re
from typing import Optional
from openai import OpenAI

from app.services.memory import memory  # ← ПРАВИЛЬНЫЙ ИМПОРТ
from app.core.prompts import build_system_prompt
from app.services.tasks import get_task, random_task_by_level

# ... остальной код


API_KEY = os.getenv("API_KEY")
BASE_URL = "https://llm.t1v.scibox.tech/"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
MODEL_NAME = "qwen3-coder-30b-a3b-instruct-fp8"

# Маппинг уровней интервью
LEVEL_NAMES = {
    1: "Junior",
    2: "Middle", 
    3: "Senior",
    4: "Expert"
}

def parse_coding_task(text: str) -> Optional[dict]:
    if not text:
        return None

    task_id_match = re.search(r"task_id:\s*([\w\-]+)", text, re.IGNORECASE)
    desc_match = re.search(
        r"description:\s*([\s\S]*?)(?:template:|```python)", text, re.IGNORECASE
    )
    template_match = (
        re.search(r"```python([\s\S]+?)```", text, re.IGNORECASE)
        or re.search(r"```([\s\S]+?)```", text, re.IGNORECASE)
    )

    if not task_id_match:
        return None

    return {
        "task_id": task_id_match.group(1).strip(),
        "description": desc_match.group(1).strip() if desc_match else "",
        "template": template_match.group(1).strip() if template_match else "",
    }

def make_final_report():
    system_prompt = (
        "Сформируй итоговое резюме технического интервью.\n\n"
        "Формат строго такой:\n"
        "**Теория:** X%\n"
        "**Практика:** Y%\n"
        "**Сильные стороны:**\n"
        "— пункт 1\n"
        "— пункт 2\n"
        "**Зоны роста:**\n"
        "— пункт 1\n"
        "— пункт 2\n"
        "**Вердикт:** <текст>\n"
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(memory.get_context())

    resp = client.chat.completions.create(
        model=MODEL_NAME,
        messages=messages,
        max_tokens=900,
        temperature=0.4,
    )

    return resp.choices[0].message.content

async def ask_qwen(message: str, mode: str, code_result: Optional[dict] = None):
    mode = (mode or "TECH").upper()
    memory.mode = mode

    # 🔓 СЕКРЕТНАЯ КОМАНДА: прямой вход в практику
    if message.lower().strip() == "практика от витуса":
        memory.reset_full()
        memory.stage = "practice-confirm"
        memory.interview_level = 2  # По умолчанию Middle
        return {
            "answer": "🔓 Режим практики активирован! Готовы начать solving tasks?",
            "next_task": None,
            "is_final": False,
            "secret_command": True
        }

    if mode == "TECH" and len(memory.history) == 0:
        memory.reset_full()

    # ЭТАП 1: INTRO - выбор уровня интервью
    if memory.stage == "intro":
        memory.add_user_message(message)
        
        if message.lower() in ["привет", "привет!", "hi", "hello", "ok", "окей", "начать", "начнём", "готов"]:
            memory.stage = "level_select"
            response = (
                "Привет! Готов к техническому интервью? 🚀\n\n"
                "Выбери уровень сложности:\n"
                "1️⃣ Junior — базовые вопросы и задачи\n"
                "2️⃣ Middle — стандартные вопросы\n"
                "3️⃣ Senior — сложные архитектурные вопросы\n"
                "4️⃣ Expert — экспертный уровень\n\n"
                "Ответь цифрой (1, 2, 3 или 4)"
            )
            memory.add_assistant_message(response)
            return {
                "answer": response,
                "next_task": None,
                "is_final": False
            }

        # Иначе ответим как обычно в intro режиме
        system_prompt = build_system_prompt("TECH")
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(memory.get_context())

        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=500,
            temperature=0.7,
        )
        answer = resp.choices[0].message.content
        memory.add_assistant_message(answer)
        return {"answer": answer, "next_task": None, "is_final": False}

    # ЭТАП 2: LEVEL_SELECT - выбрана сложность
    if memory.stage == "level_select":
        memory.add_user_message(message)
        
        level_map = {"1": 1, "2": 2, "3": 3, "4": 4}
        level = level_map.get(message.strip())
        
        if level:
            memory.interview_level = level
            memory.coding_level = level  # Уровень кодинга соответствует уровню интервью
            memory.stage = "theory"
            memory.theory_questions_asked = 0
            
            level_name = LEVEL_NAMES[level]
            response = (
                f"✅ Уровень **{level_name}** выбран!\n\n"
                "Начинаем теоретическую часть. На каждый вопрос отвечай подробно.\n\n"
                "Вопрос 1️⃣: Расскажи о различиях между mutable и immutable типами в Python. "
                "Приведи примеры."
            )
            memory.add_assistant_message(response)
            memory.theory_questions_asked = 1
            return {"answer": response, "next_task": None, "is_final": False}
        
        # Неверный ввод
        response = "Пожалуйста, выбери уровень цифрой: 1, 2, 3 или 4"
        memory.add_assistant_message(response)
        return {"answer": response, "next_task": None, "is_final": False}

    # FEEDBACK — разбор тестов coding-задачи
    if memory.stage == "feedback" and code_result is not None:
        hint_count = getattr(memory, "hint_count", 0)

        tests_text = "\n".join(code_result["results"])

        full_msg = (
            "Вот результаты выполнения кода кандидата:\n\n"
            f"{tests_text}\n\n"
            "Если все тесты пройдены — похвали и выдай следующую задачу строго в формате task_id/description/template.\n"
            "Если есть ошибки — дай ОДНУ мягкую подсказку (начинай со слова 'Может...').\n"
            "После двух неудачных попыток — заверши интервью и подготовь итоговый отчёт.\n"
        )

        messages = [{"role": "system", "content": build_system_prompt("TECH")}]
        messages.extend(memory.get_context())
        messages.append({"role": "user", "content": full_msg})

        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=1200,
            temperature=0.4,
        )

        answer = resp.choices[0].message.content
        memory.add_assistant_message(answer)

        parsed = parse_coding_task(answer)

        if parsed:
            memory.stage = "coding"
            memory.current_task = parsed["task_id"]
            memory.hint_count = 0
            return {
                "answer": answer,
                "next_task": parsed,
                "is_final": False
            }
        else:
            memory.hint_count = hint_count + 1

        if memory.hint_count >= 2 and not code_result["success"]:
            final_report = make_final_report()
            memory.add_assistant_message(final_report)
            memory.reset_full()
            return {
                "answer": final_report,
                "next_task": None,
                "is_final": True
            }

        return {
            "answer": answer,
            "next_task": None,
            "is_final": False
        }

    # THEORY / CODING / PRACTICE_CONFIRM — нормальный поток
    if mode != "TECH":
        system_prompt = build_system_prompt(mode)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(memory.get_context())

        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=900,
            temperature=0.7,
        )
        answer = resp.choices[0].message.content
        memory.add_user_message(message)
        memory.add_assistant_message(answer)
        return {
            "answer": answer,
            "next_task": None,
            "is_final": False
        }

    # ТЕОРИЯ: анализ ответа
    if memory.stage == "theory":
        memory.add_user_message(message)
        
        # Проверка, готов ли кандидат перейти к практике
        if message.lower() in ["да", "готов", "начать", "лайв-кодинг", "практика"]:
            if memory.theory_questions_asked >= 5:
                memory.stage = "practice_confirm"
                response = (
                    "Отлично! Теоретическая часть завершена.\n\n"
                    "Переходим к практической части. Будете решать задачи в live-coding.\n"
                    "Готовы начать? Напишите: да"
                )
                memory.add_assistant_message(response)
                return {"answer": response, "next_task": None, "is_final": False}
            else:
                response = (
                    f"У нас ещё есть теоретические вопросы ({memory.theory_questions_asked}/5). "
                    "Давайте продолжим!"
                )
                memory.add_assistant_message(response)
                return {"answer": response, "next_task": None, "is_final": False}

        # Получить следующий теоретический вопрос
        system_prompt = build_system_prompt("TECH")
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(memory.get_context())

        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=800,
            temperature=0.6,
        )

        answer = resp.choices[0].message.content
        memory.add_assistant_message(answer)
        memory.theory_questions_asked += 1

        # После 5 вопросов предлагаем переход к практике
        if memory.theory_questions_asked >= 5:
            answer = (
                answer + "\n\n"
                "---\n\n"
                "Теоретическая часть близится к завершению. "
                "Готовы переходить к live-coding? Напишите: да"
            )

        return {"answer": answer, "next_task": None, "is_final": False}

    # PRACTICE_CONFIRM
    if memory.stage == "practice_confirm":
        memory.add_user_message(message)
        
        if message.lower() in ["да", "готов", "ок", "поехали", "начать"]:
            # Выбираем задачу по уровню кодинга
            coding_level = memory.coding_level
            task_id = random_task_by_level(coding_level)
            
            if task_id:
                task = get_task(task_id)
                memory.stage = "coding"
                memory.current_task = task_id
                memory.hint_count = 0
                
                response = (
                    f"🎯 Задача уровня **Level {coding_level}**:\n\n"
                    f"**{task['description']}**\n\n"
                    f"Ваш шаблон:\n"
                    f"```python\n{task['template']}\n```\n\n"
                    f"Напишите решение в редакторе слева."
                )
                
                memory.add_assistant_message(response)
                
                return {
                    "answer": response,
                    "next_task": {
                        "task_id": task_id,
                        "description": task['description'],
                        "template": task['template']
                    },
                    "is_final": False
                }

        # Иначе оставляемся в режиме practice_confirm
        response = "Когда будешь готов, напиши: да"
        memory.add_assistant_message(response)
        return {"answer": response, "next_task": None, "is_final": False}

    # CODING: ждем результатов тестирования
    if memory.stage == "coding":
        memory.add_user_message(message)
        response = "⏳ Запускаю тесты вашего кода..."
        memory.add_assistant_message(response)
        return {"answer": response, "next_task": None, "is_final": False}

    # DEFAULT
    if mode != "TECH":
        system_prompt = build_system_prompt(mode)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(memory.get_context())

        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=900,
            temperature=0.7,
        )
        answer = resp.choices[0].message.content
        memory.add_assistant_message(answer)
        return {"answer": answer, "next_task": None, "is_final": False}

    # Fallback
    return {
        "answer": "Извини, что-то пошло не так. Попробуй ещё раз.",
        "next_task": None,
        "is_final": False
    }
