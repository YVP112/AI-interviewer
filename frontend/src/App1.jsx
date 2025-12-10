import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { sendMessage, runCode, resetConversation } from "./api/backend";
import InterviewResults from "./components/InterviewResults";
import "./style.css";

// -----------------------------------------
// СПИСОК ЗАДАЧ
// -----------------------------------------
const TASKS = [
  {
    task_id: "reverse_string",
    description: "Напишите функцию reverse(s), которая разворачивает строку.",
    template: `def reverse(s):
    pass`,
  },
  {
    task_id: "sum_array",
    description: "Напишите функцию sum_array(a), которая возвращает сумму массива.",
    template: `def sum_array(a):
    pass`,
  },
  {
    task_id: "is_palindrome",
    description: "Напишите функцию is_palindrome(s), которая проверяет является ли строка палиндромом.",
    template: `def is_palindrome(s):
    pass`,
  },
];

function pickRandomTask() {
  return TASKS[Math.floor(Math.random() * TASKS.length)];
}

// -----------------------------------------
// HISTORY HELPER
// -----------------------------------------
function saveToHistory(task, results) {
  const history = JSON.parse(localStorage.getItem("interviewHistory") || "[]");
  const newEntry = {
    taskId: task.task_id,
    taskTitle: task.description.substring(0, 50),
    score: results.theory + results.practice,
    theory: results.theory,
    practice: results.practice,
    verdict: results.verdict,
    timestamp: new Date().toLocaleString("ru-RU"),
  };
  history.unshift(newEntry);
  localStorage.setItem("interviewHistory", JSON.stringify(history.slice(0, 30)));
}

function getHistory() {
  return JSON.parse(localStorage.getItem("interviewHistory") || "[]");
}

function clearHistory() {
  localStorage.removeItem("interviewHistory");
}

// -----------------------------------------
// TYPING ANIMATION HELPER
// -----------------------------------------
function AnimatedText({ text, speed = 15 }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (displayed.length < text.length) {
      const timeout = setTimeout(() => {
        setDisplayed(text.slice(0, displayed.length + 1));
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [displayed, text, speed]);

  return (
    <>
      {displayed}
      {displayed.length < text.length && (
        <span
          style={{
            display: "inline-block",
            animation: "blink 0.7s infinite",
            marginLeft: "2px",
          }}
        >
          ▌
        </span>
      )}
    </>
  );
}

export default function App() {
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [stage, setStage] = useState("intro");

  const [currentTask, setCurrentTask] = useState(null);
  const [code, setCode] = useState("");
  const [runResults, setRunResults] = useState(null);
  const [editorVisible, setEditorVisible] = useState(true);

  // THEME
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [history, setHistory] = useState(getHistory());

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute(
      "data-color-scheme",
      next === "light" ? "light" : "dark"
    );
  };

  // ANTI-CHEATING
  const [cheatCount, setCheatCount] = useState(0);
  const [cheated, setCheated] = useState(false);
  const [showFirstWarning, setShowFirstWarning] = useState(false);

  // RESULTS
  const [interviewResults, setInterviewResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const textareaRef = useRef(null);
  const chatEndRef = useRef(null);
  const editorRef = useRef(null);

  // -----------------------------------------
  // ANTI-CHEATING: BLUR EVENT
  // -----------------------------------------
  useEffect(() => {
    const handleBlur = () => {
      if (stage === "coding" && !cheated) {
        setCheatCount((prev) => {
          const next = prev + 1;
          if (next === 1) {
            setShowFirstWarning(true);
            setTimeout(() => setShowFirstWarning(false), 3000);
          } else if (next >= 2) {
            setCheated(true);
          }
          return next;
        });
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [stage, cheated]);

  // -----------------------------------------
  function updateBot(answer) {
    setChat((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], bot: answer };
      return next;
    });
  }

  // -----------------------------------------
  function parseResultsFromLLM(text) {
    const scoreRegex = /\*\*Теория:\*\*\s*(\d+)/;
    const practiceRegex = /\*\*Практика:\*\*\s*(\d+)/;
    const strengthRegex = /\*\*Сильные стороны:\*\*\s*([^*]+?)(?=\*\*|$)/;
    const growthRegex = /\*\*Зоны роста:\*\*\s*([^*]+?)(?=\*\*|$)/;
    const verdictRegex = /\*\*Вердикт:\*\*\s*(.+?)(?=\*\*|$)/;

    const result = {
      theory: text.match(scoreRegex)?.[1]
        ? parseInt(text.match(scoreRegex)[1])
        : 0,
      practice: text.match(practiceRegex)?.[1]
        ? parseInt(text.match(practiceRegex)[1])
        : 0,
      strengths: text.match(strengthRegex)
        ? text
            .match(strengthRegex)[1]
            .split("—")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      growth: text.match(growthRegex)
        ? text
            .match(growthRegex)[1]
            .split("—")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      verdict: text.match(verdictRegex)?.[1]?.trim() || "",
      rawFeedback: text,
    };

    return result;
  }

  // -----------------------------------------
  function parseTaskFromLLM(text) {
    const taskIdMatch = text.match(/task_id:\s*([a-zA-Z0-9\-_]+)/i);
    const descMatch = text.match(/description:\s*([\s\S]*?)template:/i);
    const templateMatch = text.match(/```python([\s\S]+?)```/i);

    if (!taskIdMatch || !templateMatch) return null;

    return {
      task_id: taskIdMatch[1],
      description: descMatch ? descMatch[1].trim() : "",
      template: templateMatch[1].trim(),
    };
  }

  // -----------------------------------------
  async function send() {
    if (!msg.trim() || isSending || cheated || showFirstWarning) return;

    const text = msg;
    setMsg("");
    setIsSending(true);

    setChat((p) => [...p, { user: text, bot: "" }]);

    try {
      if (stage === "intro") {
        if (["да", "готов", "ок", "поехали"].includes(text.toLowerCase())) {
          const task = pickRandomTask();
          setCurrentTask(task);
          setCode(task.template);

          setChat((p) => [
            ...p,
            {
              user: null,
              bot:
                `Вот ваша первая задача:\n\n${task.description}\n\n` +
                `Введите решение в редакторе ниже и нажмите «Запустить».`,
            },
          ]);

          setStage("coding");
          return;
        }

        const res = await sendMessage(text, "TECH");
        updateBot(res.answer);
        return;
      }

      if (stage === "coding") {
        const res = await sendMessage(text, "TECH");
        updateBot(res.answer);

        if (
          res.answer.includes("Теория:") ||
          res.answer.includes("**Вердикт:**")
        ) {
          const parsed = parseResultsFromLLM(res.answer);
          setInterviewResults(parsed);
          saveToHistory(currentTask, parsed);
          setHistory(getHistory());
          setShowResults(true);
          setStage("results");
        }
      }
    } catch (err) {
      console.error(err);
      updateBot("Ошибка сервера.");
    } finally {
      setIsSending(false);
    }
  }

  // -----------------------------------------
  async function onRunCode() {
    if (!currentTask || cheated || showFirstWarning) return;

    setRunResults({ running: true });

    try {
      const res = await runCode(code, currentTask.task_id);
      setRunResults(res);

      if (res.llm_feedback) {
        setChat((p) => [...p, { user: "[анализ кода]", bot: res.llm_feedback }]);

        const parsedTask = parseTaskFromLLM(res.llm_feedback);
        if (parsedTask) {
          setCurrentTask(parsedTask);
          setCode(parsedTask.template);
          setRunResults(null);
          return;
        }

        if (
          res.llm_feedback.includes("Теория:") ||
          res.llm_feedback.includes("**Вердикт:**")
        ) {
          const parsed = parseResultsFromLLM(res.llm_feedback);
          setInterviewResults(parsed);
          saveToHistory(currentTask, parsed);
          setHistory(getHistory());
          setShowResults(true);
          setStage("results");
        }
      }
    } catch (err) {
      console.error(err);
      setRunResults({ success: false, results: ["Ошибка запуска кода"] });
    }
  }

  // -----------------------------------------
  async function resetChat() {
    try {
      await resetConversation();
    } catch {}

    setChat([]);
    setMsg("");
    setStage("intro");
    setCurrentTask(null);
    setCode("");
    setRunResults(null);
    setEditorVisible(true);
    setCheatCount(0);
    setCheated(false);
    setShowFirstWarning(false);
    setInterviewResults(null);
    setShowResults(false);
  }

  // AUTOSCROLL
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (!textareaRef.current) return;
    const t = textareaRef.current;
    t.style.height = "auto";
    t.style.height = Math.min(160, t.scrollHeight) + "px";
  }, [msg]);

  function handleComposerKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // APPLY THEME ON MOUNT
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-color-scheme",
      theme === "light" ? "light" : "dark"
    );
  }, [theme]);

  // -----------------------------------------
  return (
    <div className={`app ${theme === "light" ? "light" : ""}`}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">VI</div>
          <div className="brand-text">
            <h1>Технический интервьюер</h1>
            <p className="muted">Live coding</p>
          </div>
        </div>

        <button className="btn btn-ghost" onClick={toggleTheme} style={{ width: "100%" }}>
          {theme === "dark" ? "☀️ Светлая тема" : "🌙 Тёмная тема"}
        </button>

        <section className="card">
          <h2>Как это работает</h2>
          <ul className="tips">
            <li>1) Теоретические вопросы по Python.</li>
            <li>2) Задачи в формате live-coding.</li>
            <li>3) Финальный отчёт о результатах.</li>
          </ul>

          <div style={{ marginTop: "1.2rem" }}>
            <h2>Античитинг</h2>
            <ul className="tips">
              <li>❗ Запрещено переключаться между вкладками и окнами.</li>
              <li>❗ Запрещено копирование и вставка текста.</li>
            </ul>
          </div>
        </section>

        {/* ИСТОРИЯ */}
        {history.length > 0 && (
          <section className="card">
            <h2>История ({history.length})</h2>
            <ul
              className="tips"
              style={{ maxHeight: "180px", overflowY: "auto", fontSize: "11px" }}
            >
              {history.map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    marginBottom: "8px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ fontWeight: "600", fontSize: "12px" }}>
                    {item.score >= 160 ? "✅" : item.score >= 100 ? "✓" : "⚠️"} {item.taskTitle.substring(0, 25)}
                  </div>
                  <div style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}>
                    Т:{item.theory} П:{item.practice}
                  </div>
                  <div style={{ color: "var(--color-text-secondary)", fontSize: "10px" }}>
                    {item.timestamp}
                  </div>
                </li>
              ))}
            </ul>
            <button
              className="btn btn-ghost"
              onClick={() => {
                clearHistory();
                setHistory([]);
              }}
              style={{ width: "100%", marginTop: "8px", fontSize: "12px" }}
            >
              Очистить
            </button>
          </section>
        )}

        <div className="sidebar-footer muted">v2.0 ENHANCED</div>
      </aside>

      {/* MAIN CHAT */}
      <main className="chat">
        <header className="chat-header">
          <h2>Сессия технического интервью</h2>

          <div className="chat-actions">
            <button className="btn btn-ghost" onClick={resetChat}>
              Начать заново
            </button>
          </div>
        </header>

        <section className="chat-window">
          {chat.length === 0 && (
            <div className="msg msg-ai">
              <div className="avatar">AI</div>
              <div className="bubble">
                <AnimatedText text="Добро пожаловать! Готовы начать техническое интервью?" speed={20} />
              </div>
            </div>
          )}

          {chat.map((c, i) => (
            <div key={i} className="msg-group">
              {c.user && (
                <div className="msg msg-user">
                  <div className="bubble">{c.user}</div>
                </div>
              )}
              {c.bot && (
                <div className="msg msg-ai">
                  <div className="avatar">AI</div>
                  <div className="bubble">
                    <AnimatedText text={c.bot} speed={15} />
                  </div>
                </div>
              )}
            </div>
          ))}

          <div ref={chatEndRef} />
        </section>

        {showResults && interviewResults && (
          <InterviewResults data={interviewResults} />
        )}

        {stage === "coding" && currentTask && (
          <section className="compiler">
            <div className="compiler-header">
              <div>
                <div className="compiler-title">Live coding</div>
                <div className="muted">{currentTask.task_id}</div>
              </div>

              <button
                className="btn btn-ghost"
                onClick={() => setEditorVisible(!editorVisible)}
              >
                {editorVisible ? "Скрыть" : "Показать"}
              </button>
            </div>

            {editorVisible && (
              <>
                <div className="compiler-task">{currentTask.description}</div>

                <div className="monaco-wrapper">
                  <Editor
                    height="250px"
                    defaultLanguage="python"
                    value={code}
                    onChange={(value) => setCode(value || "")}
                    theme={theme === "light" ? "light" : "vs-dark"}
                    onMount={(editor) => {
                      editorRef.current = editor;
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco",
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 4,
                      wordWrap: "on",
                    }}
                  />
                </div>

                <div className="compiler-actions">
                  <button
                    className="btn"
                    onClick={onRunCode}
                    disabled={cheated || showFirstWarning || runResults?.running}
                  >
                    {runResults?.running ? "Запуск..." : "Запустить"}
                  </button>
                </div>

                {runResults && !runResults.running && (
                  <div className="compiler-results">
                    <div
                      className={
                        runResults.success ? "result-good" : "result-bad"
                      }
                    >
                      {runResults.success ? "✓ Все тесты пройдены" : "✗ Есть ошибки"}
                    </div>

                    {runResults.results.map((r, i) => (
                      <div key={i} className="result-item">
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={textareaRef}
            className="input"
            placeholder="Введите сообщение…"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={handleComposerKey}
            disabled={cheated || showFirstWarning}
          />

          <button
            className="btn"
            type="submit"
            disabled={cheated || showFirstWarning || !msg.trim()}
          >
            Отправить
          </button>
        </form>

        {showFirstWarning && (
          <div
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              background: "var(--color-warning)",
              color: "white",
              padding: "12px 20px",
              borderRadius: "8px",
              fontWeight: "600",
              zIndex: 9998,
              animation: "slideIn 0.3s ease-out",
            }}
          >
            ⚠️ Предупреждение: не переключайтесь между вкладками!
          </div>
        )}

        {cheated && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              color: "#fff",
              padding: "2rem",
              textAlign: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            <h2
              style={{
                fontSize: "2.4rem",
                marginBottom: "1rem",
                fontWeight: 700,
                color: "#ff4444",
              }}
            >
              Интервью остановлено
            </h2>

            <p
              style={{
                fontSize: "1.2rem",
                maxWidth: 600,
                marginBottom: "2rem",
                color: "#ffffff",
              }}
            >
              Обнаружено повторное переключение вкладки или окна. Чтобы продолжить — начните интервью заново.
            </p>

            <button
              className="btn"
              onClick={resetChat}
              style={{ padding: "0.8rem 2rem", fontSize: "1.2rem" }}
            >
              Начать заново
            </button>
          </div>
        )}
      </main>

      {/* CSS ANIMATIONS */}
      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}