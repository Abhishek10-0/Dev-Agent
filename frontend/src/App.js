import { useState } from "react";
import axios from "axios";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [standup, setStandup] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Backend se Claude call karo
  const askClaude = async (prompt) => {
    const res = await axios.post("http://localhost:8080/api/claude", { prompt });
    return res.data.text;
  };

  const fetchStandup = async () => {
    setLoading(true);
    setStandup("");
    try {
      const res = await axios.get("http://localhost:8080/api/standup");
      setData(res.data);

      const prompt = `You are a dev standup assistant. Based on this data, generate a crisp daily standup:

✅ YESTERDAY: What was worked on
🎯 TODAY: What to focus on  
🚧 BLOCKERS: Any issues
💡 INSIGHT: One smart observation

Data:
GitHub Repos: ${JSON.stringify(res.data.repos)}
Slack Channels: ${JSON.stringify(res.data.channels)}
Notion Last Edited: ${res.data.notion[0]?.last_edited_time}
Cross-source JOIN: ${JSON.stringify(res.data.joined)}

Keep it under 150 words. Be practical and slightly pirate-themed!`;

      const answer = await askClaude(prompt);
      setStandup(answer);
    } catch (err) {
      setStandup("Error: " + err.message);
    }
    setLoading(false);
  };

  const askQuestion = async () => {
    if (!chatInput.trim() || !data) return;
    const question = chatInput;
    setChatInput("");
    setChatLoading(true);
    setChatHistory(prev => [...prev, { role: "user", text: question }]);

    try {
      const prompt = `You are a dev productivity agent. Answer this question based on the data below.
Question: ${question}
GitHub Repos: ${JSON.stringify(data.repos)}
Slack Channels: ${JSON.stringify(data.channels)}
Notion: ${JSON.stringify(data.notion)}
Be concise and helpful.`;

      const answer = await askClaude(prompt);
      setChatHistory(prev => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "assistant", text: "Error: " + err.message }]);
    }
    setChatLoading(false);
  };

  return (
    <div style={{ background: "#0a1628", minHeight: "100vh", color: "white", fontFamily: "monospace", padding: "2rem" }}>

      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.5rem", color: "#f0c040", margin: 0 }}>🏴‍☠️ Dev Standup Agent</h1>
        <p style={{ color: "#94a3b8", marginTop: "0.5rem" }}>GitHub + Slack + Notion — powered by Coral SQL + AI</p>
      </div>

      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <button onClick={fetchStandup} disabled={loading} style={{
          padding: "1rem 3rem", background: loading ? "#334155" : "#f0c040",
          color: "#0a1628", border: "none", borderRadius: "12px",
          fontWeight: "bold", fontSize: "1.2rem", cursor: loading ? "not-allowed" : "pointer"
        }}>
          {loading ? "⚓ Fetching from all sources..." : "🚀 Generate My Standup"}
        </button>
      </div>

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", maxWidth: "900px", margin: "0 auto 2rem" }}>
          {[
            { label: "GitHub Repos", count: data.repos?.length, color: "#60a5fa", icon: "⚔️" },
            { label: "Slack Channels", count: data.channels?.length, color: "#34d399", icon: "💬" },
            { label: "Notion Pages", count: data.notion?.length, color: "#c084fc", icon: "📋" },
            { label: "Cross JOINs", count: data.joined?.length, color: "#f0c040", icon: "🔗" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#1e293b", borderRadius: "12px", padding: "1rem", textAlign: "center", border: `1px solid ${s.color}33` }}>
              <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: s.color }}>{s.count}</div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {standup && (
        <div style={{ maxWidth: "900px", margin: "0 auto 2rem", background: "#1e293b", borderRadius: "12px", padding: "2rem", border: "1px solid #f0c04044" }}>
          <h2 style={{ color: "#f0c040", marginTop: 0 }}>🗺️ Today's Standup</h2>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", color: "#e2e8f0" }}>{standup}</div>
        </div>
      )}

      {data && (
        <div style={{ maxWidth: "900px", margin: "0 auto", background: "#1e293b", borderRadius: "12px", padding: "2rem", border: "1px solid #60a5fa33" }}>
          <h2 style={{ color: "#60a5fa", marginTop: 0 }}>🤖 Ask Your Agent</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Ask anything about your repos, channels, or tasks!</p>

          <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "1rem" }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{
                marginBottom: "0.75rem", padding: "0.75rem", borderRadius: "8px",
                background: msg.role === "user" ? "#0f172a" : "#0f2a1a",
                borderLeft: `3px solid ${msg.role === "user" ? "#60a5fa" : "#34d399"}`
              }}>
                <div style={{ color: msg.role === "user" ? "#60a5fa" : "#34d399", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                  {msg.role === "user" ? "👤 You" : "🤖 Agent"}
                </div>
                <div style={{ color: "#e2e8f0", whiteSpace: "pre-wrap" }}>{msg.text}</div>
              </div>
            ))}
            {chatLoading && <div style={{ color: "#94a3b8" }}>🤖 Thinking...</div>}
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && askQuestion()}
              placeholder="Ask: Which repo should I focus on today?"
              style={{
                flex: 1, padding: "0.75rem", background: "#0f172a",
                border: "1px solid #334155", borderRadius: "8px",
                color: "white", fontSize: "0.9rem"
              }}
            />
            <button onClick={askQuestion} disabled={chatLoading} style={{
              padding: "0.75rem 1.5rem", background: "#60a5fa",
              color: "#0a1628", border: "none", borderRadius: "8px",
              fontWeight: "bold", cursor: "pointer"
            }}>
              Ask ⚡
            </button>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "2rem", color: "#475569", fontSize: "0.75rem" }}>
        3 sources • 1 SQL query • 0 glue code • Coral + AI
      </div>
    </div>
  );
}