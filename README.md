
# 🏴‍☠️ Dev Standup Agent

I built this because I was tired of opening GitHub, then Slack, then Notion every single morning just to figure out what I did yesterday and what I should do today.

This agent does it all in one click.

## What it does

You press one button. Coral SQL quietly joins your GitHub repos, Slack channels, and Notion tasks in a single query — no API juggling, no copy-pasting. Then an AI reads that data and writes your standup for you. Real data. Real output.

It also spots repos you haven't touched in months and flags them. Because we all have that one abandoned project we keep meaning to get back to.

And since Notion is where I actually track my work, I made it so you can add tasks, mark them done, and change their status — all from the same screen, without ever opening Notion.

## The part that surprised me

I expected the hardest part to be the AI. It wasn't. It was realising that Coral could JOIN GitHub and Slack like they were tables in the same database:

```sql
SELECT r.name, r.pushed_at, s.name as slack_channel
FROM github.repositories r
JOIN slack.channels s ON 1=1
WHERE r.pushed_at < '2025-11-01'
ORDER BY r.pushed_at ASC
```

That query runs across two completely different APIs. No glue code. No ETL. Just SQL.

## Stack

- **Coral** — the thing that makes all of this possible
- **GitHub** — repo and activity data
- **Slack** — channels and workspace
- **Notion** — tasks, with full read and write
- **Groq (llama-3.1)** — generates the standup
- **React + Node.js** — frontend and backend

## Running it locally

```bash
# Install Coral
brew install withcoral/tap/coral
coral source add github
coral source add slack
coral source add notion

# Backend
cd backend
npm install
node server.js

# Frontend
cd frontend
npm install
npm start
```

You'll need a `.env` in the backend folder with:

GROQ_API_KEY=your_groq_key
NOTION_TOKEN=your_notion_token

## Built for Pirates of the Coral-bean Hackathon

Track 2 — Personal Agent
