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
    const { stdout } = await execAsync(`coral sql "SELECT id, url, last_edited_time FROM notion.pages WHERE page_id = '36e9f76d450780ddb4f1dc5806ca8736'" --format json`);
    res.json(JSON.parse(stdout));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notion Tasks fetch karo
app.get('/api/notion/tasks', async (req, res) => {
  try {
    const { stdout } = await execAsync(`coral sql "SELECT id, properties, url FROM notion.data_source_pages WHERE data_source_id = '36e9f76d450780f6b0a4000bda8e4c58'" --format json`);
    const rows = JSON.parse(stdout);
    const tasks = rows.map(row => {
      const props = JSON.parse(row.properties);
      const name = props.Name?.title?.[0]?.plain_text || 'Untitled';
      const status = props.Status?.status?.name || 'Unknown';
      const priority = props.Priority?.select?.name || 'None';
      return { id: row.id, name, status, priority, url: row.url };
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notion Task ADD karo
app.post('/api/notion/tasks', async (req, res) => {
  try {
    const { name, priority } = req.body;
    const response = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: '36e9f76d-4507-80d7-b480-f7bdaca83c89' },
        properties: {
          Name: { title: [{ text: { content: name } }] },
          Priority: { select: { name: priority || 'Medium' } },
          Status: { status: { name: 'Not started' } }
        }
      })
    });
    const data = await response.json();
    res.json({ success: true, id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Task Status Update karo
app.patch('/api/notion/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        properties: {
          Status: { status: { name: status } }
        }
      })
    });
    const data = await response.json();
    res.json({ success: true, id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Neglected Repos — GitHub + Slack JOIN
app.get('/api/insights', async (req, res) => {
  try {
    const { stdout } = await execAsync(`coral sql "SELECT r.name, r.language, r.pushed_at, r.open_issues_count, s.name as slack_channel FROM github.repositories r JOIN slack.channels s ON 1=1 WHERE r.owner__login = 'Abhishek10-0' AND r.pushed_at < '2025-11-01' ORDER BY r.pushed_at ASC LIMIT 6" --format json`);
    const neglected = JSON.parse(stdout);

    // Unique repos nikalo
    const seen = new Set();
    const uniqueRepos = neglected.filter(r => {
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });

    res.json({ neglected: uniqueRepos, total: uniqueRepos.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Standup Agent
app.get('/api/standup', async (req, res) => {
  try {
    const [repos, channels, notion, tasks] = await Promise.all([
      coralQuery('SELECT name, description FROM github.repositories LIMIT 5'),
      coralQuery('SELECT name FROM slack.channels LIMIT 10'),
      execAsync(`coral sql "SELECT url, last_edited_time FROM notion.pages WHERE page_id = '36e9f76d450780ddb4f1dc5806ca8736'" --format json`).then(r => JSON.parse(r.stdout)),
      execAsync(`coral sql "SELECT id, properties, url FROM notion.data_source_pages WHERE data_source_id = '36e9f76d450780f6b0a4000bda8e4c58'" --format json`).then(r => {
        const rows = JSON.parse(r.stdout);
        return rows.map(row => {
          const props = JSON.parse(row.properties);
          return {
            name: props.Name?.title?.[0]?.plain_text || 'Untitled',
            status: props.Status?.status?.name || 'Unknown',
            priority: props.Priority?.select?.name || 'None'
          };
        });
      })
    ]);

    const joined = await coralQuery(
      'SELECT r.name as repo, s.name as channel FROM github.repositories r JOIN slack.channels s ON 1=1 LIMIT 6'
    );

    res.json({ repos, channels, notion, tasks, joined, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Groq AI
app.post('/api/claude', async (req, res) => {
  try {
    const { prompt } = req.body;
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
    res.json({ text: data.choices?.[0]?.message?.content || "Error" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
});

process.stdin.resume();