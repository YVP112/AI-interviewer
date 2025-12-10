import tempfile
import subprocess
import sys
import textwrap
from app.services.tasks import get_task


def run_in_sandbox(code: str, task_id: str):
    task = get_task(task_id)
    if not task:
        return {
            "task": task_id,
            "success": False,
            "results": [f"Неизвестная задача: {task_id}"],
            "llm_feedback": None,
        }

    tests = task.get("tests", [])
    if len(tests) == 0:
        return {
            "task": task_id,
            "success": True,
            "results": ["Нет автотестов — ручная проверка."],
            "llm_feedback": None,
        }

    results = []
    global_success = True

    for test in tests:
        expr = test["expr"]
        expected = test["expected"]

        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            filename = f.name
            script = f"""
{code}

try:
    result = eval({repr(expr)})
    print("__RESULT__", repr(result))
except Exception as e:
    print("__ERROR__", str(e))
"""
            f.write(textwrap.dedent(script))

        # --- SECURITY EXECUTION ---
        proc = subprocess.Popen(
            [sys.executable, filename],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        try:
            out, err = proc.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            results.append(f"✗ {expr} → Превышено время выполнения")
            global_success = False
            continue

        if "__ERROR__" in out:
            error_msg = out.split("__ERROR__")[1].strip()
            results.append(f"✗ {expr} → Ошибка: {error_msg}")
            global_success = False
            continue

        if "__RESULT__" in out:
            actual_str = out.split("__RESULT__")[1].strip()
            try:
                actual = eval(actual_str)
            except:
                actual = actual_str
        else:
            results.append(f"✗ {expr} → Не удалось получить результат")
            global_success = False
            continue

        if actual == expected:
            results.append(f"✓ {expr} → {actual}")
        else:
            results.append(f"✗ {expr} → Ожидалось {expected}, получено {actual}")
            global_success = False

    return {
        "task": task_id,
        "success": global_success,
        "results": results,
        "llm_feedback": None,
    }
