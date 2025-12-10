import React, { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function InterviewResults({ data }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const totalScore = Math.round((data.theory + data.practice) / 2);

  const verdictLabel =
    totalScore >= 85 ? "Отличный результат" :
    totalScore >= 70 ? "Хороший уровень" :
    totalScore >= 50 ? "Средний уровень" :
    "Нужна доработка";

  const verdictColor =
    totalScore >= 85 ? "#19c37d" :
    totalScore >= 70 ? "#3b82f6" :
    totalScore >= 50 ? "#fbbf24" :
    "#ef4444";

  const donutData = {
    labels: ["Уровень", "Остаток"],
    datasets: [
      {
        data: [totalScore, 100 - totalScore],
        backgroundColor: [verdictColor, "rgba(180,180,180,0.15)"],
        borderWidth: 0,
      },
    ],
  };

  const donutOptions = {
    cutout: "70%",
    plugins: {
      legend: { display: false },
    },
  };

  const barData = {
    labels: ["Теория", "Практика"],
    datasets: [
      {
        label: "Процент",
        data: [data.theory, data.practice],
        backgroundColor: ["#6366f1", "#8b5cf6"],
        borderRadius: 8,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        min: 0,
        max: 100,
        ticks: { stepSize: 20 },
        grid: { color: "rgba(200,200,200,0.1)" },
      },
    },
  };

  return (
    <div ref={ref} className="results-container">

      <div className="results-card main">
        <div className="donut-wrapper">
          <Doughnut data={donutData} options={donutOptions} />
          <div className="donut-center">
            <div className="donut-score">{totalScore}%</div>
          </div>
        </div>

        <div className="summary-text">
          <h2 style={{ color: verdictColor }}>{verdictLabel}</h2>
          <p className="summary-sub">Общая итоговая оценка кандидата</p>
        </div>
      </div>

      <div className="results-card">
        <h3>Оценки по направлениям</h3>
        <div style={{ height: "180px" }}>
          <Bar data={barData} options={barOptions} />
        </div>
      </div>

      {data.strengths.length > 0 && (
        <div className="results-card">
          <h3>💪 Сильные стороны</h3>
          <ul className="list">
            {data.strengths.map((str, idx) => (
              <li key={idx} className="list-item positive">
                <span>✓</span> {str}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.growth.length > 0 && (
        <div classname="results-card">
          <h3>📈 Зоны роста</h3>
          <ul className="list">
            {data.growth.map((g, idx) => (
              <li key={idx} className="list-item neutral">
                <span>→</span> {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.verdict && (
        <div className="results-card final-verdict">
          <h3>Итоговый вердикт</h3>
          <div className="verdict-box">
            {data.verdict}
          </div>
        </div>
      )}

      <div className="results-card">
        <h3>Полный комментарий</h3>
        <pre className="full-report">{data.rawFeedback}</pre>
      </div>
    </div>
  );
}