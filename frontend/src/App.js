import { useState } from "react";
import axios from "axios";

const API = "http://localhost:8080";
const priorityColor = (p) => ({ High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e", None: "#64748b" }[p] || "#64748b");
const statusColor = (s) => ({ "In progress": "#3b82f6", "Not started": "#64748b", "Done": "#22c55e" }[s] || "#64748b");

export default function App() {
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [standup, setStandup] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [addingTask, setAddingTask] = useState(false);
  const [updatingTask, setUpdatingTask] = useState(null);
  const [activeSQL, setActiveSQL] = useState(null);

  const askClaude = async (prompt) => {
    const res = await axios.post(`${API}/api/claude`, { prompt });
    return res.data.text;
  };

  const fetchTasks = async () => {
    const res = await axios.get(`${API}/api/notion/tasks`);
    setTasks(res.data);
  };

  const updateTaskStatus = async (id, status) => {
    setUpdatingTask(id);
    try {
      await axios.patch(`${API}/api/notion/tasks/${id}`, { status });
      await fetchTasks();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setUpdatingTask(null);
  };

  const fetchStandup = async () => {
    setLoading(true);
    setStandup("");
    const sqlQuery = `SELECT r.name, r.language, r.pushed_at, s.name as slack_channel\nFROM github.repositories r\nJOIN slack.channels s ON 1=1\nWHERE r.owner__login = 'Abhishek10-0'\nORDER BY r.pushed_at ASC`;
    setActiveSQL(sqlQuery);
    try {
      const [standupRes, insightsRes] = await Promise.all([
        axios.get(`${API}/api/standup`),
        axios.get(`${API}/api/insights`),
        fetchTasks()
      ]);
      setData(standupRes.data);
      setInsights(insightsRes.data);

      const prompt = `You are a dev standup assistant. Based on ONLY this real data, generate a daily standup:

✅ YESTERDAY: Tasks that are "In progress" or "Done"
🎯 TODAY: Top 3 High priority "Not started" tasks  
🚧 BLOCKERS: Any issues you notice
💡 PRIORITY TIP: Which task to do first and why

REAL DATA:
GitHub Repos: ${JSON.stringify(standupRes.data.repos)}
Slack Channels: ${JSON.stringify(standupRes.data.channels)}
Notion Tasks: ${JSON.stringify(standupRes.data.tasks)}
Neglected Repos: ${JSON.stringify(insightsRes.data.neglected)}

IMPORTANT: Only use facts from above. No made up info. Under 150 words.`;

      const answer = await askClaude(prompt);
      setStandup(answer);
    } catch (err) {
      setStandup("Error: " + err.message);
    }
    setLoading(false);
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    setAddingTask(true);
    try {
      await axios.post(`${API}/api/notion/tasks`, { name: newTask, priority: newPriority });
      setNewTask("");
      await fetchTasks();
    } catch (err) {
      alert("Error: " + err.message);
    }
    setAddingTask(false);
  };

  const askQuestion = async () => {
    if (!chatInput.trim() || !data) return;
    const question = chatInput;
    setChatInput("");
    setChatLoading(true);
    setChatHistory(prev => [...prev, { role: "user", text: question }]);
    try {
      const answer = await askClaude(`You are a dev productivity agent. Answer based on this data only.
Question: ${question}
GitHub Repos: ${JSON.stringify(data.repos)}
Slack Channels: ${JSON.stringify(data.channels)}
Notion Tasks: ${JSON.stringify(tasks)}
Neglected Repos: ${JSON.stringify(insights?.neglected)}
Be concise and helpful.`);
      setChatHistory(prev => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "assistant", text: "Error: " + err.message }]);
    }
    setChatLoading(false);
  };

  const getScore = () => {
    if (!tasks.length) return 0;
    const done = tasks.filter(t => t.status === "Done").length;
    const inProgress = tasks.filter(t => t.status === "In progress").length;
    return Math.round(((done + inProgress * 0.5) / tasks.length) * 100);
  };

  const score = getScore();
  const scoreColor = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ background: "#0a1628", minHeight: "100vh", color: "white", fontFamily: "monospace", padding: "2rem" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.5rem", color: "#f0c040", margin: 0 }}>🏴‍☠️ Dev Standup Agent</h1>
        <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>GitHub + Slack + Notion — Coral SQL + AI</p>
      </div>

      {/* Generate Button */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <button onClick={fetchStandup} disabled={loading} style={{
          padding: "1rem 3rem", background: loading ? "#334155" : "#f0c040",
          color: "#0a1628", border: "none", borderRadius: "12px",
          fontWeight: "bold", fontSize: "1.2rem", cursor: loading ? "not-allowed" : "pointer"
        }}>
          {loading ? "⚓ Fetching from all sources..." : "🚀 Generate My Standup"}
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", maxWidth: "1000px", margin: "0 auto 2rem" }}>
          {[
            { label: "GitHub Repos", count: data.repos?.length, color: "#60a5fa", icon: "⚔️" },
            { label: "Slack Channels", count: data.channels?.length, color: "#34d399", icon: "💬" },
            { label: "Notion Tasks", count: tasks?.length, color: "#c084fc", icon: "📋" },
            { label: "Cross JOINs", count: data.joined?.length, color: "#f0c040", icon: "🔗" },
            { label: "Productivity", count: `${score}%`, color: scoreColor, icon: "📊" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#1e293b", borderRadius: "12px", padding: "1rem", textAlign: "center", border: `1px solid ${s.color}33` }}>
              <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
              <div style={{ fontSize: i === 4 ? "1.5rem" : "2rem", fontWeight: "bold", color: s.color }}>{s.count}</div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Live SQL */}
      {activeSQL && (
        <div style={{ maxWidth: "1000px", margin: "0 auto 2rem", background: "#0f172a", borderRadius: "12px", padding: "1.5rem", border: "1px solid #34d39933" }}>
          <div style={{ color: "#34d399", fontSize: "0.75rem", marginBottom: "0.5rem" }}>⚡ LIVE CORAL SQL QUERY</div>
          <pre style={{ color: "#e2e8f0", margin: 0, fontSize: "0.85rem", overflowX: "auto" }}>{activeSQL}</pre>
          {data && (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "0.5rem" }}>📊 RESULT ({data.joined?.length} rows)</div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {data.joined?.map((row, i) => (
                  <span key={i} style={{ padding: "0.25rem 0.75rem", background: "#1e293b", borderRadius: "999px", fontSize: "0.75rem", color: "#94a3b8" }}>
                    {row.repo} → {row.channel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Standup */}
      {standup && (
        <div style={{ maxWidth: "1000px", margin: "0 auto 2rem", background: "#1e293b", borderRadius: "12px", padding: "2rem", border: "1px solid #f0c04044" }}>
          <h2 style={{ color: "#f0c040", marginTop: 0 }}>🗺️ Today's Standup</h2>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", color: "#e2e8f0" }}>{standup}</div>
        </div>
      )}

      {/* Neglected Repos */}
      {insights && insights.neglected?.length > 0 && (
        <div style={{ maxWidth: "1000px", margin: "0 auto 2rem", background: "#1e293b", borderRadius: "12px", padding: "2rem", border: "1px solid #ef444433" }}>
          <h2 style={{ color: "#ef4444", marginTop: 0 }}>🔥 Neglected Repos — Action Needed!</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "1rem" }}>
            Coral SQL: GitHub × Slack JOIN — repos not pushed in 6+ months
          </p>
          <div style={{ background: "#0f172a", borderRadius: "8px", padding: "1rem", marginBottom: "1rem", fontSize: "0.75rem", color: "#34d399" }}>
            <pre style={{ margin: 0 }}>{`SELECT r.name, r.pushed_at, s.name as slack_channel
FROM github.repositories r
JOIN slack.channels s ON 1=1
WHERE r.pushed_at < '2025-11-01'`}</pre>
          </div>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {insights.neglected.map((repo, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "#0f172a", borderRadius: "8px", border: "1px solid #ef444433" }}>
                <div>
                  <span style={{ color: "#ef4444", fontWeight: "bold" }}>⚠️ {repo.name}</span>
                  <span style={{ color: "#94a3b8", fontSize: "0.8rem", marginLeft: "0.75rem" }}>{repo.language}</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                    Last push: {new Date(repo.pushed_at).toLocaleDateString()}
                  </span>
                  <span style={{ padding: "0.2rem 0.6rem", background: "#34d39922", color: "#34d399", borderRadius: "999px", fontSize: "0.7rem" }}>
                    #{repo.slack_channel}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "1rem", color: "#94a3b8", fontSize: "0.75rem", textAlign: "center" }}>
            ☝️ These repos need attention — consider posting an update in Slack!
          </div>
        </div>
      )}

      {/* Notion Tasks */}
      {tasks.length > 0 && (
        <div style={{ maxWidth: "1000px", margin: "0 auto 2rem", background: "#1e293b", borderRadius: "12px", padding: "2rem", border: "1px solid #c084fc33" }}>
          <h2 style={{ color: "#c084fc", marginTop: 0 }}>📋 Notion Tasks</h2>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()}
              placeholder="Add new task..."
              style={{ flex: 1, padding: "0.6rem", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "white", fontSize: "0.9rem" }} />
            <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
              style={{ padding: "0.6rem", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "white" }}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <button onClick={addTask} disabled={addingTask} style={{ padding: "0.6rem 1.2rem", background: "#c084fc", color: "#0a1628", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
              {addingTask ? "Adding..." : "+ Add"}
            </button>
          </div>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {tasks.map((task, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "#0f172a", borderRadius: "8px", border: `1px solid ${task.status === "Done" ? "#22c55e33" : "#1e293b"}`, opacity: task.status === "Done" ? 0.6 : 1 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#e2e8f0", textDecoration: task.status === "Done" ? "line-through" : "none" }}>{task.name}</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.7rem", background: `${statusColor(task.status)}22`, color: statusColor(task.status), border: `1px solid ${statusColor(task.status)}44` }}>{task.status}</span>
                  <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.7rem", background: `${priorityColor(task.priority)}22`, color: priorityColor(task.priority), border: `1px solid ${priorityColor(task.priority)}44` }}>{task.priority}</span>
                  {task.status !== "Done" && (
                    <>
                      {task.status === "Not started" && (
                        <button onClick={() => updateTaskStatus(task.id, "In progress")} disabled={updatingTask === task.id}
                          style={{ padding: "0.2rem 0.6rem", background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f644", borderRadius: "6px", fontSize: "0.7rem", cursor: "pointer" }}>
                          {updatingTask === task.id ? "..." : "▶ Start"}
                        </button>
                      )}
                      <button onClick={() => updateTaskStatus(task.id, "Done")} disabled={updatingTask === task.id}
                        style={{ padding: "0.2rem 0.6rem", background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44", borderRadius: "6px", fontSize: "0.7rem", cursor: "pointer" }}>
                        {updatingTask === task.id ? "..." : "✓ Done"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Agent */}
      {data && (
        <div style={{ maxWidth: "1000px", margin: "0 auto 2rem", background: "#1e293b", borderRadius: "12px", padding: "2rem", border: "1px solid #60a5fa33" }}>
          <h2 style={{ color: "#60a5fa", marginTop: 0 }}>🤖 Ask Your Agent</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Ask anything — "Which repos am I neglecting?" or "What should I work on first?"</p>
          <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "1rem" }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ marginBottom: "0.75rem", padding: "0.75rem", borderRadius: "8px", background: msg.role === "user" ? "#0f172a" : "#0f2a1a", borderLeft: `3px solid ${msg.role === "user" ? "#60a5fa" : "#34d399"}` }}>
                <div style={{ color: msg.role === "user" ? "#60a5fa" : "#34d399", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                  {msg.role === "user" ? "👤 You" : "🤖 Agent"}
                </div>
                <div style={{ color: "#e2e8f0", whiteSpace: "pre-wrap" }}>{msg.text}</div>
              </div>
            ))}
            {chatLoading && <div style={{ color: "#94a3b8" }}>🤖 Thinking...</div>}
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askQuestion()}
              placeholder="Which repos am I neglecting?"
              style={{ flex: 1, padding: "0.75rem", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "white", fontSize: "0.9rem" }} />
            <button onClick={askQuestion} disabled={chatLoading} style={{ padding: "0.75rem 1.5rem", background: "#60a5fa", color: "#0a1628", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
              Ask ⚡
            </button>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "1rem", color: "#475569", fontSize: "0.75rem" }}>
        3 sources • 1 SQL query • 0 glue code • Coral + AI
      </div>
    </div>
  );
}