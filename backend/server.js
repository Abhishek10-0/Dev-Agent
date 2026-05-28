import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import dotenv from 'dotenv';


dotenv.config();


const execAsync = promisify(exec);
const app = express();
app.use(cors());
app.use(express.json());

async function coralQuery(sql) {
  const { stdout } = await execAsync(`coral sql "${sql}" --format json`);
  return JSON.parse(stdout);
}

// Slack channels
app.get('/api/slack/channels', async (req, res) => {
  try {
    const data = await coralQuery('SELECT name FROM slack.channels LIMIT 10');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GitHub repos
app.get('/api/github/repos', async (req, res) => {
  try {
    const data = await coralQuery('SELECT name, description, updated_at FROM github.repositories LIMIT 10');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notion pages
app.get('/api/notion/pages', async (req, res) => {
  try {
    const { stdout } = await execAsync(`coral sql "SELECT id, url, last_edited_time FROM notion.pages WHERE page_id = '36c9f76d4507804bbb53fe577e1c96b4'" --format json`);
    res.json(JSON.parse(stdout));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🤖 STANDUP AGENT — Main endpoint
app.get('/api/standup', async (req, res) => {
  try {
    // Coral se teeno sources ka data ek saath lo
    const [repos, channels, notion] = await Promise.all([
      coralQuery('SELECT name, description FROM github.repositories LIMIT 5'),
      coralQuery('SELECT name FROM slack.channels LIMIT 10'),
      execAsync(`coral sql "SELECT url, last_edited_time FROM notion.pages WHERE page_id = '36c9f76d4507804bbb53fe577e1c96b4'" --format json`).then(r => JSON.parse(r.stdout))
    ]);

    // Cross-source JOIN query
    const joined = await coralQuery(
      'SELECT r.name as repo, s.name as channel FROM github.repositories r JOIN slack.channels s ON 1=1 LIMIT 6'
    );

    res.json({
      repos,
      channels,
      notion,
      joined,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/claude', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("Groq key:", process.env.GROQ_API_KEY?.slice(0, 10));
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      })
    });
    const data = await response.json();
    console.log("Groq response:", JSON.stringify(data)); // YE ADD KARO
    res.json({ text: data.choices?.[0]?.message?.content || "Error" });
  } catch (err) {
    console.log("Groq error:", err.message); // YE ADD KARO
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
});

process.stdin.resume();