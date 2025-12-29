
# ARAG Insurance Agent Copilot v2.0

An AI-powered assistant designed for ARAG agents to automate email analysis and drafting using the **Master System Prompt** workflow.

## 🚀 Quick Start (Using your API Key)

1. **Install Node.js**: Ensure [Node.js](https://nodejs.org/) is installed.
2. **Environment Variable**: Set your API key in the terminal before starting:
   ```bash
   export API_KEY="AIzaSyB8wvWcM1hekD7VctwdJnR-BPVO4eLgrGY"
   ```
3. **Run Application**:
   ```bash
   npm install -D vite
   npx vite
   ```

## ☁️ Cloud Memory (Supabase)
To share memory across multiple computers:
1. Create a table named `client_memory` in your Supabase SQL Editor:
   ```sql
   create table client_memory (
     id uuid default gen_random_uuid() primary key,
     client_id text not null,
     summary text not null,
     date text not null,
     created_at timestamp with time zone default now()
   );
   ```
2. Enter your **Supabase URL** and **Anon Key** in the **Cloud Settings** (top navbar) of the app.

## 🧠 Master System Prompt Workflow
- **Task 1: Extraction**: Transcribes screenshot text and identifies tone.
- **Task 2: Memory**: Cross-references with previous summaries in Cloud/Local storage.
- **Task 3: Generation**: Drafts empathetic, ARAG-compliant replies based on your **Agent Playbook**.

## 📄 License
Confidential - ARAG Internal Use.
