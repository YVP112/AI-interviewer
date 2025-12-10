import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { sendMessage, runCode, resetConversation } from "./api/backend";
import InterviewResults from "./components/InterviewResults";
import "./style.css";

const TASKS = [
  {
    task_id: "reverse_string",
    description: "Напишите функцию reverse(s), которая разворачивает строку.",
    template: `def reverse(s):\n    pass`,
  },
  {
    task_id: "sum_array",
    description: "Напишите функцию sum_array(a), которая возвращает сумму массива.",
    template: `def sum_array(a):\n    pass`,
  },
  {
    task_id: "is_palindrome",
    description: "Напишите функцию is_palindrome(s), которая проверяет является ли строка палиндромом.",
    template: `def is_palindrome(s):\n    pass`,
  },
];

function pickRandomTask() {
  return TASKS[Math.floor(Math.random() * TASKS.length)];
}

function saveSessionToHistory(chat, results, currentTask) {
  const sessions = JSON.parse(localStorage.getItem("interviewSessions") || "[]");
  const newSession = {
    id: Date.now(),
    timestamp: new Date().toLocaleString("ru-RU"),
    date: new Date().toISOString().split('T')[0],
    dayOfWeek: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][new Date().getDay()],
    taskId: currentTask?.task_id,
    taskDesc: currentTask?.description.substring(0, 50),
    score: results?.theory + results?.practice || 0,
    theory: results?.theory || 0,
    practice: results?.practice || 0,
    verdict: results?.verdict || "",
    chatLength: chat.length,
    messages: chat.slice(0, 10),
    fullChat: chat,
    results: {
      theory: results?.theory || 0,
      practice: results?.practice || 0,
      strengths: results?.strengths || [],
      growth: results?.growth || [],
      verdict: results?.verdict || "",
      rawFeedback: results?.rawFeedback || "",
    },
  };
  sessions.unshift(newSession);
  localStorage.setItem("interviewSessions", JSON.stringify(sessions.slice(0, 50)));
}

function getSessions() {
  return JSON.parse(localStorage.getItem("interviewSessions") || "[]");
}

function getSessionStatistics(sessions) {
  const stats = {
    totalSessions: sessions.length,
    totalScore: 0,
    averageScore: 0,
    bestScore: 0,
    byDay: { 'Пн': 0, 'Вт': 0, 'Ср': 0, 'Чт': 0, 'Пт': 0, 'Сб': 0, 'Вс': 0 },
    byLevel: { Junior: 0, Middle: 0, Senior: 0, Expert: 0 },
  };

  sessions.forEach(session => {
    stats.totalScore += session.score;
    stats.bestScore = Math.max(stats.bestScore, session.score);
    if (session.dayOfWeek) stats.byDay[session.dayOfWeek]++;
    
    if (session.score < 100) stats.byLevel.Junior++;
    else if (session.score < 250) stats.byLevel.Middle++;
    else if (session.score < 350) stats.byLevel.Senior++;
    else stats.byLevel.Expert++;
  });

  stats.averageScore = sessions.length > 0 ? Math.round(stats.totalScore / sessions.length) : 0;
  return stats;
}

function saveToHistory(task, results) {
  const history = JSON.parse(localStorage.getItem("interviewHistory") || "[]");
  const newEntry = {
    taskId: task?.task_id,
    taskTitle: task?.description.substring(0, 50) || "Интервью",
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

  const renderText = (str) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.match(/^\*\*[^*]+\*\*$/)) {
        const content = part.replace(/\*\*/g, "");
        return (
          <div
            key={i}
            style={{
              fontSize: "18px",
              fontWeight: "700",
              marginTop: "12px",
              marginBottom: "8px",
              letterSpacing: "0.5px",
            }}
          >
            {content}
          </div>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <>
      {renderText(displayed)}
      {displayed.length < text.length && (
        <span style={{ display: "inline-block", animation: "blink 0.7s infinite", marginLeft: "2px", color: "#1a1410" }}>▌</span>
      )}
    </>
  );
}

function parseResultsFromLLM(text) {
  const scoreMatch = text.match(/(?:Теория|теория)[:\s]*(\d+)/);
  const practiceMatch = text.match(/(?:Практика|практика)[:\s]*(\d+)/);
  const strengthsMatch = text.match(/(?:Сильные стороны|сильные стороны)[:\s]*([^\n]+?)(?=\n\n|Зоны|зоны|$)/s);
  const growthMatch = text.match(/(?:Зоны роста|зоны роста)[:\s]*([^\n]+?)(?=\n\n|Вердикт|вердикт|$)/s);
  const verdictMatch = text.match(/(?:Вердикт|вердикт)[:\s]*([^\n]+?)(?=\n|$)/);

  const theory = scoreMatch ? parseInt(scoreMatch[1]) : 0;
  const practice = practiceMatch ? parseInt(practiceMatch[1]) : 0;

  const parseList = (text) => {
    if (!text) return [];
    return text
      .split(/[\n—•\-*]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2);
  };

  return {
    theory,
    practice,
    strengths: strengthsMatch ? parseList(strengthsMatch[1]) : [],
    growth: growthMatch ? parseList(growthMatch[1]) : [],
    verdict: verdictMatch ? verdictMatch[1].trim() : "",
    rawFeedback: text,
  };
}

function ActivityChart({ sessions }) {
  const stats = getSessionStatistics(sessions);
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const maxCount = Math.max(...Object.values(stats.byDay), 1);

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(255, 149, 0, 0.1) 0%, rgba(255, 128, 0, 0.05) 100%)",
      borderRadius: "12px",
      padding: "20px",
      border: "1px solid rgba(255, 128, 0, 0.2)",
      animation: "slideUp 0.5s ease-out 0.1s backwards",
    }}>
      <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 16px 0", color: "#ff47e0ff", display: "flex", alignItems: "center", gap: "8px" }}>
        📊 Активность по дням недели
      </h3>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: "150px", gap: "8px" }}>
        {days.map((day, i) => {
          const count = stats.byDay[day];
          const height = (count / maxCount) * 120;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "40px",
                  height: `${height}px`,
                  background: "linear-gradient(180deg, #ff00c3ff 0%, #ff00ccff 100%)",
                  borderRadius: "8px 8px 0 0",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(255, 128, 0, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scaleY(1.1)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 0, 187, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scaleY(1)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 0, 162, 0.3)";
                }}
              />
              <span style={{ fontSize: "12px", color: "#ff47c5ff", fontWeight: "600" }}>{day}</span>
              <span style={{ fontSize: "11px", color: "#a0a0c0" }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatisticsModal({ sessions, userName, onClose, onChangeName }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userName);
  const stats = getSessionStatistics(sessions);

  const handleSaveName = () => {
    if (newName.trim()) {
      onChangeName(newName);
      setIsEditingName(false);
      localStorage.setItem("userName", newName);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        padding: "20px",
        animation: "fadeIn 0.3s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1410",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "900px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",              border: "1px solid rgba(139, 92, 246, 0.25)",
              width: "100%",
              animation: "scaleIn 0.4s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
            <div>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "700", color: "#fff", animation: "slideDown 0.4s ease-out" }}>
                📊 Ваш профиль
              </h2>
              <p style={{ margin: 0, color: "#D8B4FE", fontSize: "14px" }}>
                Статистика и достижения
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "28px",
                cursor: "pointer",
                padding: 0,
                color: "#A78BFA",
                lineHeight: 1,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C4B5FD")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#A78BFA")}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "28px",
            color: "white",
            boxShadow: "0 8px 24px rgba(168, 85, 247, 0.3)",
            animation: "slideUp 0.5s ease-out 0.1s backwards",
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div style={{ fontSize: "48px" }}>👤</div>
          <div style={{ flex: 1 }}>
            {isEditingName ? (
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "18px",
                    flex: 1,
                    background: "rgba(255,255,255,0.2)",
                    color: "white",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  placeholder="Введите имя"
                />
                <button
                  onClick={handleSaveName}
                  style={{
                    padding: "8px 16px",
                    background: "rgba(255,255,255,0.2)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  ✓
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                style={{
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <h3 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: "700" }}>
                  {userName || "Пользователь"} ✏️
                </h3>
                <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>Нажмите, чтобы изменить имя</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          <div
            style={{
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              textAlign: "center",
              animation: "slideUp 0.5s ease-out 0.15s backwards",
            }}
          >
            <div style={{ fontSize: "12px", color: "#ff47d1ff", marginBottom: "8px", fontWeight: "500" }}>
              📝 Всего интервью
            </div>
            <div style={{ fontSize: "40px", fontWeight: "700", color: "#ff00d9ff", lineHeight: 1 }}>
              {stats.totalSessions}
            </div>
          </div>

          <div
            style={{
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              textAlign: "center",
              animation: "slideUp 0.5s ease-out 0.2s backwards",
            }}
          >
            <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "8px", fontWeight: "500" }}>
              📊 Средний балл
            </div>
            <div style={{ fontSize: "40px", fontWeight: "700", color: "#4CAF50", lineHeight: 1 }}>
              {stats.averageScore}
            </div>
          </div>

          <div
            style={{
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              textAlign: "center",
              animation: "slideUp 0.5s ease-out 0.25s backwards",
            }}
          >
            <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "8px", fontWeight: "500" }}>
              🏆 Лучший результат
            </div>
            <div style={{ fontSize: "40px", fontWeight: "700", color: "#ff00c8ff", lineHeight: 1 }}>
              {stats.bestScore}
            </div>
          </div>
        </div>

        {sessions.length > 0 && <ActivityChart sessions={sessions} />}

        <div
          style={{
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid rgba(139, 92, 246, 0.25)",
            marginTop: "28px",
            animation: "slideUp 0.5s ease-out 0.2s backwards",
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 16px 0", color: "#C4B5FD" }}>
            🎯 Распределение по уровням
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            <div style={{ textAlign: "center", padding: "12px", background: "rgba(139, 92, 246, 0.15)", borderRadius: "8px", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
              <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "4px" }}>Junior</div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#A855F7" }}>{stats.byLevel.Junior}</div>
            </div>
            <div style={{ textAlign: "center", padding: "12px", background: "rgba(139, 92, 246, 0.15)", borderRadius: "8px", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
              <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "4px" }}>Middle</div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#A855F7" }}>{stats.byLevel.Middle}</div>
            </div>
            <div style={{ textAlign: "center", padding: "12px", background: "rgba(139, 92, 246, 0.15)", borderRadius: "8px", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
              <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "4px" }}>Senior</div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#A855F7" }}>{stats.byLevel.Senior}</div>
            </div>
            <div style={{ textAlign: "center", padding: "12px", background: "rgba(139, 92, 246, 0.15)", borderRadius: "8px", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
              <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "4px" }}>Expert</div>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#A855F7" }}>{stats.byLevel.Expert}</div>
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={onClose}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
            border: "none",
            marginTop: "28px",
            animation: "slideUp 0.5s ease-out 0.3s backwards",
          }}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}

function LevelSelectModal({ onSelectLevel, onClose }) {
  const levels = [
    { id: 1, name: "Junior", emoji: "🟢", description: "Базовые вопросы и задачи" },
    { id: 2, name: "Middle", emoji: "🟡", description: "Стандартные вопросы" },
    { id: 3, name: "Senior", emoji: "🔴", description: "Сложные архитектурные вопросы" },
    { id: 4, name: "Expert", emoji: "⭐", description: "Экспертный уровень" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        padding: "20px",
        animation: "fadeIn 0.3s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1410",
          borderRadius: "16px",
          padding: "40px",
          maxWidth: "600px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          animation: "scaleIn 0.4s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 12px 0", fontSize: "28px", fontWeight: "700", color: "#fff" }}>
          🎯 Выбери уровень интервью
        </h2>
        <p style={{ margin: "0 0 32px 0", fontSize: "14px", color: "#D8B4FE" }}>
          Выбери уровень сложности для начала
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
          {levels.map((level) => (
            <button
              key={level.id}
              onClick={() => onSelectLevel(level.id)}
              style={{
                padding: "16px",
                background: "rgba(139, 92, 246, 0.1)",
                border: "2px solid rgba(139, 92, 246, 0.3)",
                borderRadius: "12px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
                color: "#F5F3FF",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#A855F7";
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)";
                e.currentTarget.style.transform = "translateX(4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.1)";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              <div style={{ fontSize: "20px", marginBottom: "4px" }}>
                {level.emoji} <strong>{level.name}</strong>
              </div>
              <div style={{ fontSize: "12px", color: "#C4B5FD" }}>
                {level.description}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px 20px",
            background: "rgba(139, 92, 246, 0.1)",
            color: "#C4B5FD",
            border: "1px solid rgba(139, 92, 246, 0.25)",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function LanguageSelectModal({ onSelectLanguage, onClose }) {
  const languages = [
    { id: "python", name: "Python", emoji: "🐍", description: "Python & Backend" },
    { id: "javascript", name: "JavaScript", emoji: "🟨", description: "JavaScript & Frontend" },
    { id: "java", name: "Java", emoji: "☕", description: "Java & OOP" },
    { id: "cpp", name: "C++", emoji: "⚙️", description: "C++ & System Design" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(8px)",
        padding: "20px",
        animation: "fadeIn 0.3s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0f0d0a 0%, #1a1410 100%)",
          borderRadius: "20px",
          padding: "40px",
          maxWidth: "600px",
          width: "100%",
          boxShadow: "0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(139, 92, 246, 0.15)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          animation: "scaleIn 0.4s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 8px 0", fontSize: "32px", fontWeight: "800", background: "linear-gradient(135deg, #8B5CF6 0%, #C084FC 100%)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>
          💻 Выбери язык
        </h2>
        <p style={{ margin: "0 0 28px 0", fontSize: "14px", color: "#D8B4FE" }}>
          Выбери язык программирования для интервью
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
          {languages.map((lang, idx) => (
            <button
              key={lang.id}
              onClick={() => onSelectLanguage(lang.id)}
              style={{
                padding: "16px",
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.06) 100%)",
                border: "2px solid rgba(139, 92, 246, 0.3)",
                borderRadius: "14px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.3s ease",
                color: "#F5F3FF",
                animation: `slideUp 0.4s ease-out ${0.05 + idx * 0.05}s backwards`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#A855F7";
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)";
                e.currentTarget.style.transform = "translateX(6px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(168, 85, 247, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.06) 100%)";
                e.currentTarget.style.transform = "translateX(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "4px" }}>
                {lang.emoji} <strong style={{ fontSize: "18px" }}>{lang.name}</strong>
              </div>
              <div style={{ fontSize: "12px", color: "#C4B5FD", opacity: 0.9 }}>
                {lang.description}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px 20px",
            background: "rgba(139, 92, 246, 0.1)",
            color: "#C4B5FD",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            transition: "all 0.2s ease",
            animation: "slideUp 0.4s ease-out 0.35s backwards",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)";
            e.currentTarget.style.borderColor = "#A855F7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(139, 92, 246, 0.1)";
            e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function ResultsModal({ results, onClose }) {
  if (!results) return null;

  const score = (results.theory || 0) + (results.practice || 0);
  const maxScore = 200;
  const percentage = Math.round((score / maxScore) * 100);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        overflowY: "auto",
        padding: "20px",
        animation: "fadeIn 0.3s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1410",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "800px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255, 128, 0, 0.2)",
          animation: "scaleIn 0.4s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "700", color: "#fff", animation: "slideDown 0.4s ease-out" }}>📊 Результаты интервью</h2>
            <p style={{ margin: 0, color: "#D8B4FE", fontSize: "14px" }}>
              Полный анализ вашей производительности
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "28px",
              cursor: "pointer",
              padding: 0,
              color: "#A78BFA",
              lineHeight: 1,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#C4B5FD")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#A78BFA")}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
            borderRadius: "16px",
            padding: "28px",
            marginBottom: "28px",
            color: "white",
            boxShadow: "0 8px 24px rgba(168, 85, 247, 0.3)",
            animation: "slideUp 0.5s ease-out 0.1s backwards",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "14px", opacity: 0.9, marginBottom: "8px" }}>Общий результат</div>
              <div style={{ fontSize: "48px", fontWeight: "700" }}>
                {percentage}%
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "32px", fontWeight: "700", marginBottom: "4px" }}>
                {score} / {maxScore}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.9 }}>баллов</div>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "8px", height: "8px", overflow: "hidden" }}>
            <div
              style={{
                background: "white",
                height: "100%",
                width: `${percentage}%`,
                borderRadius: "8px",
                transition: "width 0.8s ease",
                animation: "progressFill 0.8s ease-out 0.3s backwards",
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
          <div
            style={{
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              textAlign: "center",
              animation: "slideUp 0.5s ease-out 0.2s backwards",
            }}
          >
            <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "8px", fontWeight: "500" }}>
              🧠 Теория
            </div>
            <div style={{ fontSize: "40px", fontWeight: "700", color: "#4CAF50", lineHeight: 1 }}>
              {results.theory || 0}
            </div>
            <div style={{ fontSize: "11px", color: "#a0a0c0", marginTop: "4px" }}>из 100 баллов</div>
          </div>

          <div
            style={{
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              textAlign: "center",
              animation: "slideUp 0.5s ease-out 0.3s backwards",
            }}
          >
            <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "8px", fontWeight: "500" }}>
              💻 Практика
            </div>
            <div style={{ fontSize: "40px", fontWeight: "700", color: "#2196F3", lineHeight: 1 }}>
              {results.practice || 0}
            </div>
            <div style={{ fontSize: "11px", color: "#a0a0c0", marginTop: "4px" }}>из 100 баллов</div>
          </div>
        </div>

        {results.strengths && results.strengths.length > 0 && (
          <div
            style={{
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              marginBottom: "16px",
              animation: "slideUp 0.5s ease-out 0.4s backwards",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px", color: "#C4B5FD" }}>
              💪 Сильные стороны
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#d0d0e0" }}>
              {results.strengths.map((s, i) => (
                <li key={i} style={{ marginBottom: "8px", fontSize: "14px", lineHeight: 1.5, animation: "slideUp 0.3s ease-out backwards", animationDelay: `${0.5 + i * 0.1}s` }}>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {results.growth && results.growth.length > 0 && (
          <div
            style={{
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              marginBottom: "16px",
              animation: "slideUp 0.5s ease-out 0.5s backwards",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px", color: "#C4B5FD" }}>
              📈 Зоны роста
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#d0d0e0" }}>
              {results.growth.map((g, i) => (
                <li key={i} style={{ marginBottom: "8px", fontSize: "14px", lineHeight: 1.5, animation: "slideUp 0.3s ease-out backwards", animationDelay: `${0.6 + i * 0.1}s` }}>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}

        {results.verdict && (
          <div
            style={{
              background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              marginBottom: "24px",
              color: "white",
              animation: "slideUp 0.5s ease-out 0.6s backwards",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 8px 0" }}>🎯 Итоговый вердикт</h3>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, opacity: 0.95 }}>
              {results.verdict}
            </p>
          </div>
        )}

        {results.rawFeedback && (
          <div
            style={{
              background: "#1a1410",
              borderRadius: "12px",
              padding: "20px",
              border: "1px solid rgba(139, 92, 246, 0.15)",
              marginBottom: "24px",
              animation: "slideUp 0.5s ease-out 0.7s backwards",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 12px 0", color: "#fff" }}>
              📝 Подробный анализ
            </h3>
            <div
              style={{
                color: "#d0d0e0",
                fontSize: "13px",
                lineHeight: "1.8",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: "300px",
                overflowY: "auto",
                padding: "12px",
                background: "#252540",
                borderRadius: "8px",
              }}
            >
              {results.rawFeedback}
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={onClose} style={{ width: "100%", background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)", border: "none", animation: "slideUp 0.5s ease-out 0.8s backwards" }}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

function TaskSolveButton({ task, onOpen }) {
  return (
    <button
      onClick={() => onOpen(task)}
      style={{
        marginTop: "12px",
        marginBottom: "12px",
        padding: "10px 20px",
        background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
        color: "white",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "15px",
        fontWeight: "700",
        transition: "all 0.3s ease",
        boxShadow: "0 4px 12px rgba(168, 85, 247, 0.3)",
        animation: "slideUp 0.5s ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "linear-gradient(135deg, #A855F7 0%, #C084FC 100%)";
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(168, 85, 247, 0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(168, 85, 247, 0.3)";
      }}
    >
      💻 Решить в редакторе
    </button>
  );
}

function EditorSidebar({ task, code, setCode, runResults, onRunCode, onClose, theme }) {
  const editorRef = useRef(null);

  if (!task) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: "450px",
        background: "#1a1410",
        borderLeft: "2px solid #8B5CF6",
        boxShadow: "-8px 0 20px rgba(139, 92, 246, 0.15)",
        display: "flex",
        flexDirection: "column",
        zIndex: 4000,
        animation: "slideInRight 0.3s ease-out",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)",
          borderBottom: "1px solid rgba(139, 92, 246, 0.25)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          animation: "fadeIn 0.4s ease-out",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "700", color: "#fff" }}>
            💻 Решить задачу
          </h3>
          <p style={{ margin: 0, fontSize: "12px", color: "#C4B5FD" }}>{task.task_id}</p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
            color: "#8B5CF6",
            lineHeight: 1,
            padding: 0,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#C4B5FD")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#8B5CF6")}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(139, 92, 246, 0.15)",
          fontSize: "13px",
          color: "#E9D5FF",
          lineHeight: "1.6",
          background: "rgba(139, 92, 246, 0.02)",
          animation: "fadeIn 0.5s ease-out 0.1s backwards",
        }}
      >
        {task.description}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden", background: "#0d1117" }}>
          <Editor
            key={task?.task_id}
            height="100%"
            defaultLanguage="python"
            value={code}
            onChange={(value) => setCode(value || "")}
            theme="vs-dark"
            onMount={(editor) => {
              editorRef.current = editor;
              editor.updateOptions({ 
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: "on",
              });
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco",
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
            }}
          />
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(139, 92, 246, 0.15)", background: "#1a1410" }}>
          <button
            onClick={onRunCode}
            disabled={runResults?.running}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s ease",
              opacity: runResults?.running ? 0.6 : 1,
              boxShadow: "0 4px 12px rgba(168, 85, 247, 0.3)",
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(168, 85, 247, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(168, 85, 247, 0.3)";
            }}
          >
            {runResults?.running ? "⏳ Запуск..." : "▶ Запустить"}
          </button>
        </div>

        {runResults && !runResults.running && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(139, 92, 246, 0.15)", overflowY: "auto", maxHeight: "200px", background: "#1a1410", animation: "slideUp 0.3s ease-out" }}>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                marginBottom: "8px",
                background: runResults.success ? "rgba(76, 175, 80, 0.2)" : "rgba(255, 68, 68, 0.2)",
                color: runResults.success ? "#4CAF50" : "#ff4444",
                fontWeight: "600",
              }}
            >
              {runResults.success ? "✓ Все тесты пройдены!" : "✗ Есть ошибки"}
            </div>
            {runResults.results && runResults.results.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 12px",
                  background: "#252540",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#d0d0e0",
                  marginBottom: "6px",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                  animation: "fadeIn 0.3s ease-out",
                }}
              >
                {r}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionsModal({ sessions, onClose, onLoadChat, onViewResults, onClearSessions }) {
  const [selectedSession, setSelectedSession] = useState(null);

  if (!selectedSession) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 5000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(4px)",
          padding: "20px",
          animation: "fadeIn 0.3s ease-out",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "#1a1410",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "700px",
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255, 128, 0, 0.2)",
            width: "100%",
            animation: "scaleIn 0.4s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ margin: 0, fontSize: "24px", color: "#fff", animation: "slideDown 0.4s ease-out" }}>📋 История интервью ({sessions.length})</h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                padding: 0,
                color: "#A78BFA",
                lineHeight: 1,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#C4B5FD")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#A78BFA")}
            >
              ✕
            </button>
          </div>

          {sessions.length === 0 ? (
            <p style={{ color: "#a0a0c0", textAlign: "center", padding: "40px 0", animation: "fadeIn 0.4s ease-out" }}>
              Нет сохраненных интервью
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {sessions.map((session, idx) => (
                <div
                  key={session.id}
                  style={{
                    padding: "16px",            background: "rgba(139, 92, 246, 0.08)",
            borderRadius: "12px",
            border: "1px solid rgba(139, 92, 246, 0.25)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            animation: "slideUp 0.3s ease-out backwards",
            animationDelay: `${idx * 0.05}s`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#A855F7";
                    e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)";
                    e.currentTarget.style.transform = "translateX(4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.25)";
                    e.currentTarget.style.background = "rgba(139, 92, 246, 0.08)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "4px", color: "#fff" }}>
                      {session.score >= 160 ? "✅" : session.score >= 100 ? "✓" : "⚠️"} {session.taskDesc || "Интервью"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#C4B5FD", marginBottom: "4px" }}>
                      Т:{session.theory} П:{session.practice} | {session.score}/200 баллов
                    </div>
                    <div style={{ fontSize: "11px", color: "#D8B4FE" }}>
                      {session.timestamp}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSession(session);
                      }}
                      style={{
                        fontSize: "12px",
                        padding: "8px 12px",
                        background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(168, 85, 247, 0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      📋 Просмотр
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, animation: "slideUp 0.4s ease-out 0.1s backwards" }}>
              Закрыть
            </button>
            {sessions.length > 0 && (
              <button 
                className="btn" 
                onClick={onClearSessions}
                style={{ flex: 1, background: "rgba(255, 68, 68, 0.2)", color: "#ff4444", border: "1px solid #ff4444", animation: "slideUp 0.4s ease-out 0.2s backwards" }}
              >
                🗑️ Очистить
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        padding: "20px",
        animation: "fadeIn 0.3s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1410",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "900px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255, 128, 0, 0.2)",
          width: "100%",
          animation: "scaleIn 0.4s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "#fff", animation: "slideDown 0.4s ease-out" }}>
              {selectedSession.taskDesc || "Интервью"}
            </h2>
            <p style={{ margin: 0, color: "#ff47d1ff", fontSize: "13px" }}>
              {selectedSession.timestamp}
            </p>
          </div>
          <button
            onClick={() => setSelectedSession(null)}
            style={{
              background: "none",
              border: "none",
              fontSize: "28px",
              cursor: "pointer",
              padding: 0,
              color: "#a0a0c0",
              lineHeight: 1,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ff00d4ff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#a0a0c0")}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px", animation: "slideUp 0.5s ease-out 0.1s backwards" }}>
          <div
            style={{
              background: "rgba(255, 149, 0, 0.1)",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid rgba(255, 128, 0, 0.2)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "12px", color: "#ff47c5ff", marginBottom: "8px", fontWeight: "500" }}>
              🧠 Теория
            </div>
            <div style={{ fontSize: "36px", fontWeight: "700", color: "#4CAF50", lineHeight: 1 }}>
              {selectedSession.theory}
            </div>
          </div>

          <div
            style={{
              background: "rgba(255, 149, 0, 0.1)",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid rgba(255, 128, 0, 0.2)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "12px", color: "#ff47daff", marginBottom: "8px", fontWeight: "500" }}>
              💻 Практика
            </div>
            <div style={{ fontSize: "36px", fontWeight: "700", color: "#2196F3", lineHeight: 1 }}>
              {selectedSession.practice}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#1a1410",
            borderRadius: "12px",
            padding: "16px",
            border: "1px solid rgba(255, 128, 0, 0.1)",
            marginBottom: "24px",
            maxHeight: "400px",
            overflowY: "auto",
            animation: "slideUp 0.5s ease-out 0.2s backwards",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#ff47eaff" }}>
            💬 Диалог
          </h3>
          {selectedSession.fullChat && selectedSession.fullChat.map((msg, i) => (
            <div key={i} style={{ marginBottom: "12px", animation: "fadeIn 0.3s ease-out backwards", animationDelay: `${0.25 + i * 0.05}s` }}>
              {msg.user && (
                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#ff47c2ff", fontWeight: "600" }}>Вы:</span>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#d0d0e0" }}>
                    {msg.user}
                  </p>
                </div>
              )}
              {msg.bot && (
                <div>
                  <span style={{ fontSize: "12px", color: "#ff00b3ff", fontWeight: "600" }}>AI:</span>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#d0d0e0", lineHeight: "1.4" }}>
                    {msg.bot.substring(0, 300)}
                    {msg.bot.length > 300 ? "..." : ""}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedSession.results.verdict && (
          <div
            style={{
              background: "linear-gradient(135deg, #ff00ccff 0%, #ff00ccff 100%)",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid rgba(255, 128, 0, 0.3)",
              marginBottom: "24px",
              color: "white",
              animation: "slideUp 0.5s ease-out 0.3s backwards",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 8px 0" }}>🎯 Вердикт</h3>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5 }}>
              {selectedSession.results.verdict}
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            className="btn btn-ghost"
            onClick={() => setSelectedSession(null)}
            style={{ flex: 1, animation: "slideUp 0.4s ease-out 0.1s backwards" }}
          >
            Назад к списку
          </button>
          <button
            onClick={() => {
              onLoadChat(selectedSession);
              onClose();
            }}
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #ff00bfff 0%, #ff00aeff 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px",
              cursor: "pointer",
              fontWeight: "600",
              transition: "all 0.2s ease",
              animation: "slideUp 0.4s ease-out 0.2s backwards",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 0, 204, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            📂 Загрузить чат
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [stage, setStage] = useState("intro");

  const [interviewLevel, setInterviewLevel] = useState(null);
  const [interviewLanguage, setInterviewLanguage] = useState(null);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);

  const [currentTask, setCurrentTask] = useState(null);
  const [code, setCode] = useState("");
  const [runResults, setRunResults] = useState(null);
  const [showEditorPanel, setShowEditorPanel] = useState(false);

  const [sessions, setSessions] = useState(getSessions());
  const [showSessions, setShowSessions] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "Пользователь");

  const [cheatCount, setCheatCount] = useState(0);
  const [cheated, setCheated] = useState(false);
  const [showFirstWarning, setShowFirstWarning] = useState(false);

  const [interviewResults, setInterviewResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const textareaRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const handleBlur = () => {
      if ((stage === "coding" || stage === "practice-confirm") && !cheated && showEditorPanel) {
        setCheatCount((prev) => {
          const next = prev + 1;
          if (next === 1) {
            setShowFirstWarning(true);
            setTimeout(() => setShowFirstWarning(false), 4000);
          } else if (next >= 2) {
            setCheated(true);
          }
          return next;
        });
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [stage, cheated, showEditorPanel]);

  function updateBot(answer) {
    setChat((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], bot: answer };
      return next;
    });
  }

  function openEditorForTask(task) {
    setCurrentTask(task);
    setCode(task.template);
    setRunResults(null);
    setShowEditorPanel(true);
  }

  async function send() {
    if (!msg.trim() || isSending || cheated || showFirstWarning) return;

    const text = msg;
    setMsg("");

    if (text.toLowerCase().trim() === "практика от витуса") {
      setStage("practice-confirm");
      setInterviewLevel(2);
      setInterviewLanguage("python");
      setChat((p) => [
        ...p,
        { user: text, bot: "" },
        {
          user: null,
          bot: "🔓 Режим практики активирован!\n\n✅ Язык: Python\n✅ Уровень: Middle\n\nНажми кнопку ниже, чтобы решать задачи.",
        },
        {
          user: null,
          bot: null,
          isTaskButton: true,
          task: pickRandomTask(),
        },
      ]);
      return;
    }

    if (chat.length === 0 && stage === "intro") {
      setShowLevelSelect(true);
      return;
    }

    setIsSending(true);
    setChat((p) => [...p, { user: text, bot: "" }]);

    try {
      if (stage === "intro") {
        const res = await sendMessage(text, "TECH");
        const answer = res.answer?.answer || res.answer || "";
        updateBot(answer);
        setIsSending(false);
        return;
      }

      const res = await sendMessage(text, "TECH");
      const answer = res.answer?.answer || res.answer || "";
      
      updateBot(answer);

      if (answer.includes("Можем переходить к секции live-code")) {
        setShowLanguageSelect(true);
        setStage("language-select");
      }

      if (answer.includes("Теория:") || answer.includes("**Вердикт:**")) {
        const parsed = parseResultsFromLLM(answer);
        setInterviewResults(parsed);
        saveToHistory(null, parsed);
        saveSessionToHistory(chat, parsed, null);
        setSessions(getSessions());
        setShowResults(true);
        setStage("results");
      }

      setIsSending(false);
    } catch (err) {
      console.error(err);
      updateBot("Ошибка сервера.");
      setIsSending(false);
    }
  }

  async function handleSelectLevel(level) {
    setInterviewLevel(level);
    setShowLevelSelect(false);
    setShowLanguageSelect(true);

    setChat((p) => [
      ...p,
      { user: `Уровень ${["", "Junior", "Middle", "Senior", "Expert"][level]}`, bot: "" },
    ]);

    setIsSending(true);
    try {
      const res = await sendMessage(`Выбираю уровень ${level}`, "TECH");
      const answer = res.answer?.answer || res.answer || "";
      setChat((p) => {
        const next = [...p];
        next[next.length - 1] = { ...next[next.length - 1], bot: answer };
        return next;
      });
      setStage("language-select");
    } catch (err) {
      console.error(err);
      setChat((p) => {
        const next = [...p];
        next[next.length - 1] = { ...next[next.length - 1], bot: "Ошибка сервера." };
        return next;
      });
    }
    setIsSending(false);
  }

  async function handleSelectLanguage(language) {
    setInterviewLanguage(language);
    setShowLanguageSelect(false);

    setChat((p) => [
      ...p,
      { user: `Язык: ${language}`, bot: "" },
    ]);

    setIsSending(true);
    try {
      const res = await sendMessage(`Выбираю язык программирования: ${language}`, "TECH");
      const answer = res.answer?.answer || res.answer || "";
      setChat((p) => {
        const next = [...p];
        next[next.length - 1] = { ...next[next.length - 1], bot: answer };
        return next;
      });
      setStage("practice-confirm");
    } catch (err) {
      console.error(err);
      setChat((p) => {
        const next = [...p];
        next[next.length - 1] = { ...next[next.length - 1], bot: "Ошибка сервера." };
        return next;
      });
    }
    setIsSending(false);
  }

  async function onRunCode() {
    if (!currentTask || cheated || showFirstWarning) return;

    setRunResults({ running: true });

    try {
      const res = await runCode(code, currentTask.task_id);
      setRunResults(res);

      if (res.llm_feedback) {
        setChat((p) => [...p, { user: "[анализ кода]", bot: res.llm_feedback }]);

        if (res.next_task && res.next_task.task_id) {
          const nextTask = res.next_task;
          
          setShowEditorPanel(false);
          setCurrentTask(null);
          setCode("");
          setRunResults(null);
          
          setChat((p) => [
            ...p,
            {
              user: null,
              bot: `✅ Отлично! Переходим к новой задаче:\n\n${nextTask.description}`,
            },
            {
              user: null,
              bot: null,
              isTaskButton: true,
              task: nextTask,
            },
          ]);

          return;
        }

        if (res.is_final || res.llm_feedback.includes("Теория:") || res.llm_feedback.includes("**Вердикт:**")) {
          const parsed = parseResultsFromLLM(res.llm_feedback);
          setInterviewResults(parsed);
          saveToHistory(currentTask, parsed);
          saveSessionToHistory(chat, parsed, currentTask);
          setSessions(getSessions());
          setShowResults(true);
          setStage("results");
          setShowEditorPanel(false);
          setCurrentTask(null);
          return;
        }
      }
    } catch (err) {
      console.error(err);
      setRunResults({ success: false, results: ["Ошибка запуска кода"] });
    }
  }

  async function resetChat() {
    try {
      await resetConversation();
    } catch {}

    setChat([]);
    setMsg("");
    setStage("intro");
    setInterviewLevel(null);
    setInterviewLanguage(null);
    setCurrentTask(null);
    setCode("");
    setRunResults(null);
    setShowEditorPanel(false);
    setCheatCount(0);
    setCheated(false);
    setShowFirstWarning(false);
    setInterviewResults(null);
    setShowResults(false);
  }

  function loadChatFromSession(session) {
    setChat(session.fullChat || []);
    setStage("coding");
    setMsg("");
    setCurrentTask(null);
    setCode("");
    setRunResults(null);
    setShowEditorPanel(false);
  }

  function clearAllSessions() {
    localStorage.removeItem("interviewSessions");
    setSessions([]);
    setShowSessions(false);
  }

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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand" style={{ 
          animation: "slideDown 0.5s ease-out",
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
        }}>
          <div className="logo" style={{
            background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
            color: "white",
            fontWeight: "700",
          }}>VI</div>
          <div className="brand-text">
            <h1 style={{ color: "#C4B5FD" }}>Interview Pro</h1>
            <p className="muted" style={{ color: "#A78BFA" }}>Live Coding</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px", animation: "slideUp 0.5s ease-out 0.1s backwards" }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowProfile(true)}
            style={{ width: "100%", fontSize: "14px", color: "#C4B5FD" }}
          >
            👤 Профиль
          </button>
          {sessions.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={() => setShowSessions(true)}
              style={{ width: "100%", fontSize: "14px", color: "#C4B5FD" }}
            >
              📋 История ({sessions.length})
            </button>
          )}
        </div>

        <section className="card" style={{
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          borderRadius: "14px",
          animation: "slideUp 0.5s ease-out 0.2s backwards",
        }}>
          <h2 style={{ color: "#C4B5FD", fontSize: "16px", fontWeight: "700", marginBottom: "12px" }}>🚀 Как это работает</h2>
          <ul className="tips" style={{ fontSize: "13px", lineHeight: "1.8", color: "#D8B4FE" }}>
            <li>1️⃣ Выбери уровень сложности</li>
            <li>2️⃣ Выбери язык программирования</li>
            <li>3️⃣ Ответь на теоретические вопросы</li>
            <li>4️⃣ Решай задачи в live-coding</li>
            <li>5️⃣ Получи подробный отчёт</li>
          </ul>

          <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(139, 92, 246, 0.2)" }}>
            <h2 style={{ color: "#A78BFA", fontSize: "16px", fontWeight: "700", marginBottom: "12px" }}>⚠️ Анти-читинг</h2>
            <ul className="tips" style={{ fontSize: "13px", lineHeight: "1.8", color: "#FBCFE8" }}>
              <li>🚫 Не переключайся во время решения</li>
              <li>🚫 Не открывай консоль F12</li>
              <li>✅ Решай честно и внимательно</li>
            </ul>
          </div>
        </section>

        <div className="sidebar-footer" style={{ color: "#A78BFA", fontSize: "11px", marginTop: "auto", paddingTop: "16px", borderTop: "1px solid rgba(139, 92, 246, 0.2)" }}>
          ✨ v6.1 MODERN DESIGN & ANTI-CHEAT
        </div>
      </aside>

      <main className="chat" style={{ paddingRight: showEditorPanel ? "450px" : "0", transition: "padding-right 0.3s ease" }}>
        <header className="chat-header" style={{ 
          borderBottom: "1px solid rgba(139, 92, 246, 0.2)", 
          background: "linear-gradient(135deg, #0f0d0a 0%, #1a1410 100%)",
          boxShadow: "0 4px 20px rgba(139, 92, 246, 0.05)"
        }}>
          <h2 style={{ color: "#C4B5FD", fontSize: "20px", fontWeight: "700" }}>Interview Pro</h2>
          <div className="chat-actions">
            <button className="btn btn-ghost" onClick={resetChat} style={{ color: "#C4B5FD", fontSize: "14px" }}>
              ↻ Заново
            </button>
          </div>
        </header>

        <section className="chat-window">
          {chat.length === 0 && (
            <div className="msg msg-ai" style={{ margin: "12px 0 24px 0", animation: "slideUp 0.5s ease-out" }}>
              <div className="avatar" style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)" }}>AI</div>                      <div className="bubble" style={{ borderColor: "rgba(139, 92, 246, 0.3)" }}>
                <AnimatedText text="Добро пожаловать! Готовы начать техническое интервью?" speed={20} />
              </div>
            </div>
          )}

          {chat.map((c, i) => (
            <div key={i} className="msg-group" style={{ animation: "slideUp 0.3s ease-out backwards", animationDelay: `${i * 0.05}s` }}>
              {c.isTaskButton ? (
                <TaskSolveButton task={c.task} onOpen={openEditorForTask} />
              ) : (
                <>
                  {c.user && (
                    <div className="msg msg-user">
                      <div className="bubble" style={{ borderColor: "#ff00aeff", background: "#3d2f27", color: "#ffffff", border: "2px solid #ff009dff" }}>{c.user}</div>
                    </div>
                  )}
                  {c.bot && (
                    <div className="msg msg-ai">
                      <div className="avatar" style={{ background: "linear-gradient(135deg, #ff00aaff 0%, #ff00bfff 100%)" }}>AI</div>
                      <div className="bubble" style={{ borderColor: "rgba(139, 92, 246, 0.3)", background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)" }}>
                        <AnimatedText text={c.bot} speed={15} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          <div ref={chatEndRef} />
        </section>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{ background: "#1a1410", borderTop: "1px solid rgba(255, 0, 208, 0.2)", gap: "12px", padding: "16px", display: "flex", flexDirection: "row" }}
        >
          <textarea
            ref={textareaRef}
            className="input"
            placeholder="Введите сообщение…"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={handleComposerKey}
            disabled={cheated || showFirstWarning}
            style={{ 
              background: "#2a1f18", 
              color: "#d0d0e0", 
              border: "2px solid rgba(255, 0, 225, 0.3)",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "none",
              flex: 1,
            }}
          />

          <button
            className="btn"
            type="submit"
            disabled={cheated || showFirstWarning || !msg.trim()}
            style={{ 
              background: "linear-gradient(135deg, #A855F7 0%, #A855F7 100%)", 
              border: "none", 
              transition: "all 0.2s ease",
              padding: "10px 20px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(242, 0, 255, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
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
              background: "linear-gradient(135deg, #EC4899 0%, #F472B6 100%)",
              color: "white",
              padding: "14px 24px",
              borderRadius: "10px",
              fontWeight: "700",
              zIndex: 9998,
              animation: "slideIn 0.3s ease-out",
              boxShadow: "0 8px 24px rgba(236, 72, 153, 0.4), 0 0 20px rgba(236, 72, 153, 0.2)",
              border: "1px solid rgba(236, 72, 153, 0.3)",
              fontSize: "14px",
            }}
          >
            ⚠️ Табуляция запрещена! Осталось 1 предупреждение
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
              animation: "fadeIn 0.3s ease-out",
            }}
          >
            <h2 style={{ fontSize: "2.4rem", marginBottom: "1rem", fontWeight: 700, color: "#ff4444", animation: "slideDown 0.5s ease-out" }}>
              Интервью остановлено
            </h2>

            <p style={{ fontSize: "1.2rem", maxWidth: 600, marginBottom: "2rem", color: "#ffffff", animation: "slideUp 0.5s ease-out 0.1s backwards" }}>
              Обнаружено повторное переключение вкладки. Начните интервью заново.
            </p>

            <button
              className="btn"
              onClick={resetChat}
              style={{ padding: "0.8rem 2rem", fontSize: "1.2rem", background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)", border: "none", animation: "slideUp 0.5s ease-out 0.2s backwards" }}
            >
              Начать заново
            </button>
          </div>
        )}
      </main>

      {showEditorPanel && (
        <EditorSidebar
          task={currentTask}
          code={code}
          setCode={setCode}
          runResults={runResults}
          onRunCode={onRunCode}
          onClose={() => setShowEditorPanel(false)}
          theme="dark"
        />
      )}

      {showLevelSelect && (
        <LevelSelectModal
          onSelectLevel={handleSelectLevel}
          onClose={() => setShowLevelSelect(false)}
        />
      )}

      {showLanguageSelect && (
        <LanguageSelectModal
          onSelectLanguage={handleSelectLanguage}
          onClose={() => setShowLanguageSelect(false)}
        />
      )}

      {showProfile && (
        <StatisticsModal
          sessions={sessions}
          userName={userName}
          onClose={() => setShowProfile(false)}
          onChangeName={setUserName}
        />
      )}

      {showSessions && (
        <SessionsModal
          sessions={sessions}
          onClose={() => setShowSessions(false)}
          onLoadChat={loadChatFromSession}
          onViewResults={() => {}}
          onClearSessions={clearAllSessions}
        />
      )}

      {showResults && (
        <ResultsModal results={interviewResults} onClose={() => setShowResults(false)} />
      )}

      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes progressFill {
          from { width: 0; }
        }

        .app {
          background: linear-gradient(135deg, #0f0d0a 0%, #1a1410 50%, #131110 100%) !important;
        }

        .sidebar {
          background: linear-gradient(180deg, #0f0d0a 0%, #1a1410 100%) !important;
          border-right: 1px solid rgba(139, 92, 246, 0.15) !important;
        }

        .chat-window {
          background: linear-gradient(135deg, #0f0d0a 0%, #1a1410 50%, #131110 100%) !important;
        }

        .chat-header {
          background: linear-gradient(135deg, #0f0d0a 0%, #1a1410 100%) !important;
          border-bottom: 1px solid rgba(139, 92, 246, 0.2) !important;
        }

        .composer {
          background: linear-gradient(135deg, #1a1410 0%, #0f0d0a 100%) !important;
          border-top: 1px solid rgba(139, 92, 246, 0.2) !important;
        }

        .input {
          background-color: rgba(15, 13, 10, 0.9) !important;
          color: #E9D5FF !important;
          border: 2px solid rgba(139, 92, 246, 0.3) !important;
          border-radius: 10px !important;
        }

        .input:focus {
          border-color: #A855F7 !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15) !important;
        }

        .input::placeholder {
          color: rgba(200, 180, 220, 0.4) !important;
        }

        .msg.msg-ai .bubble {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%) !important;
          color: #E9D5FF !important;
          border: 1px solid rgba(139, 92, 246, 0.3) !important;
          animation: slideUp 0.4s ease-out;
        }

        .msg.msg-user .bubble {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%) !important;
          color: #F5F3FF !important;
          border: 1px solid rgba(168, 85, 247, 0.4) !important;
          border-radius: 12px !important;
          animation: slideUp 0.4s ease-out;
        }

        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(139, 92, 246, 0.08);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #8B5CF6 0%, #A855F7 100%);
          border-radius: 10px;
          border: 2px solid rgba(139, 92, 246, 0.15);
          transition: background 0.2s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #A855F7 0%, #C084FC 100%);
        }

        main.chat {
          flex: 1;
          min-width: 0;
          transition: padding-right 0.3s ease;
        }

        .msg:first-child {
          margin-top: 0 !important;
        }

        .sidebar {
          overflow-y: auto !important;
          max-height: 100vh !important;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%);
          border-radius: 14px;
          border: 1px solid rgba(139, 92, 246, 0.25);
          margin-bottom: 16px;
        }

        .logo {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          background: linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%);
        }

        .brand-text h1 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #C4B5FD;
        }

        .brand-text .muted {
          margin: 0;
          font-size: 12px;
          color: #A78BFA !important;
        }

        body {
          background: linear-gradient(135deg, #0f0d0a 0%, #1a1410 100%) !important;
        }

        .btn {
          transition: all 0.2s ease !important;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-2px) !important;
        }

        .msg-group {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}