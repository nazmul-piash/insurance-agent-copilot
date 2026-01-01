
# ARAG Insurance Agent Copilot v2.5

An AI-powered assistant designed for ARAG agents to automate email analysis and drafting using a Master System Prompt workflow.

## 🚀 Quick Start

1. **Install Node.js**: Ensure [Node.js](https://nodejs.org/) is installed.
2. **Launch Application**:
   ```bash
   npm install
   npm run dev
   ```
3. **API Key**: When the application starts, you will be prompted to select a paid Google Cloud Project API key via the secure selection dialog.

## ☁️ Cloud Memory (Supabase)
To share memory across multiple computers:
1. Create a table named `client_memory` in your Supabase SQL Editor:
   ```sql
   create table client_memory (
     id uuid default gen_random_uuid() primary key,
     client_id text not null,
     summary text not null,
     date text not null,
     policy_number text,
     created_at timestamp with time zone default now()
   );
   ```
2. Enter your **Supabase URL** and **Anon Key** in the **Cloud Settings** (top navbar) of the app.

## 🧠 Intelligence Workflow
- **Task 1: Extraction**: Transcribes screenshot text and identifies tone using Gemini Flash.
- **Task 2: Knowledge Grounding**: Cross-references uploaded PDF handbooks and custom agent rules.
- **Task 3: Memory**: Recalls previous interactions for consistent client service.
- **Task 4: Generation**: Drafts empathetic, ARAG-compliant replies in English and German.

## 📄 License
Confidential - ARAG Internal Use.
