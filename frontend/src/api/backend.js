// Для Docker/прод: запросы идут на тот же origin -> nginx проксирует на backend
// Для локалки: vite proxy тоже отправит на localhost:8000

export async function sendMessage(message, mode = "HR") {
  const res = await fetch("/chat/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, mode })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function runCode(code, task_id) {
  const res = await fetch("/code/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, task_id })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function resetConversation() {
  const res = await fetch("/reset/", {
    method: "POST"
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getRandomTask(level) {
  const query = level ? `?level=${level}` : "";
  const res = await fetch(`/tasks/random${query}`, {
    method: "GET"
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}