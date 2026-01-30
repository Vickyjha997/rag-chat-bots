# Testing API + LangSmith

## 1. Create a session (get `sessionId`)

Use a valid `cohortKey` (e.g. your Qdrant collection name). Replace `YOUR_RAG_API_KEY` with `RAG_API_KEY` from `.env`.

```bash
curl -X POST "http://localhost:8080/api/createSession/my-cohort-key" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_RAG_API_KEY" ^
  -d "{\"fullName\":\"Jane Doe\",\"email\":\"jane@example.com\",\"currentDesignation\":\"Engineer\",\"phoneNumber\":\"+1234567890\"}"
```

Response example: `{"sessionId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","expiresAt":"..."}`.

**Copy the `sessionId`** (UUID). You must use this real UUID in the next step — not a placeholder.

---

## 2. Send a chat message (RAG)

Route: **`POST /api/chat/cohort/:cohortKey`**. Chunks are read from the Qdrant collection **`cohort{cohortKey}`** (e.g. `cohortmy-cohort-key`).

Use the **same `cohortKey`** as in step 1. Replace `PASTE_SESSION_ID_HERE` with the **actual `sessionId`** from step 1.

**Behavior:** Top 8 chunks from `cohort{cohortKey}` (ranked by score), latest 4 conversation turns, XED sales-agent prompt. Program name in prompt uses `cohortKey` for now (no API fetch).

```bash
curl -X POST "http://localhost:8080/api/chat/cohort/my-cohort-key" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_RAG_API_KEY" ^
  -d "{\"sessionId\":\"PASTE_SESSION_ID_HERE\",\"question\":\"What programs do you offer?\"}"
```

If you use the literal `"PASTE_SESSION_ID_HERE"`, you’ll get **Invalid session ID format** (sessionId must be a valid UUID). The session’s `cohort_key` must match the route’s `cohortKey`.

---

## 3. LangSmith 403 Forbidden

If you see `Failed to send multipart request. Received status [403]: Forbidden` when tracing:

- **Invalid API key**: Create a new key at [smith.langchain.com](https://smith.langchain.com) → Settings → API Keys. Set `LANGSMITH_API_KEY` in `.env`.
- **Org-scoped key**: If your key is for a workspace, set `LANGSMITH_WORKSPACE_ID` to that workspace ID in `.env`.
- **Region**: Use `LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com` for EU; omit for US.
- **Temporarily disable tracing**: Set `LANGSMITH_TRACING=false` in `.env` to stop trace uploads (and 403s) while you fix the key.

Restart the app after changing `.env`.

---

## 4. How to check LangSmith tracing

### 4.1 Confirm env and startup log

In `.env`:

```env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your-langsmith-api-key
LANGSMITH_PROJECT=rag-program-counselor
```

Restart the app (`npm run dev`). On startup you should see either:

- `LangSmith tracing ON → project: "rag-program-counselor"` → tracing is enabled.
- `LangSmith tracing OFF (...)` → tracing disabled; fix env and restart.

If you see **403 Forbidden** in the logs when calling chat/send, traces are being sent but rejected (bad key, wrong region, or org key without `LANGSMITH_WORKSPACE_ID`). Fix that first.

### 4.2 Where to look in LangSmith

1. Open [smith.langchain.com](https://smith.langchain.com) and sign in.
2. Left sidebar → **Projects** → select **rag-program-counselor** (or your `LANGSMITH_PROJECT`).
3. You should see **Traces** (or **Dataset runs**). Each `POST /api/chat/cohort/:cohortKey` request creates one trace.
4. Click a trace to open it. You’ll see **sendMessage** (root) → **RAG** → **ChatGoogleGenerativeAI**, plus metadata (`session_id`, `cohort_key`).

### 4.3 Quick test

1. Create session (step 1), then send a chat message (step 2) with the real `sessionId`.
2. Wait a few seconds (traces can take a moment to appear).
3. In LangSmith, refresh the project page and check the latest traces.
4. If nothing appears: ensure startup shows “tracing ON”, no 403 in logs, and you’re in the correct project.
