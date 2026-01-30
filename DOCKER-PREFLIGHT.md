# Pre-flight checklist before root `docker compose up`

Run from the **repo root** (`rag-chat-bots/`). One shared network (`rag-network`) so containers resolve each other by name (e.g. voice agent → backend at `http://program-counsellor-backend:8080`).

---

## 1. Root `.env`

- [ ] File **`./.env`** exists (or compose uses defaults).
- [ ] Host ports **40080, 40090, 40001, 40002** are free (used only for browser access).

---

## 2. Backend (program-counsellor-backend)

- [ ] **`backend-app/app/.env`** exists (full config: MongoDB, Redis, Qdrant, RAG_API_KEY, GEMINI_API_KEY, etc.).
- [ ] **`backend-app/.env.docker`** exists with:
  - `PORT=8080`
  - `CORS_ORIGIN=http://localhost:40090`

---

## 3. Frontend (program-counsellor-frontend)

- [ ] **`frontend-app/app/.env.docker`** exists (optional; root compose passes build args for VITE_API_BASE, VITE_VOICE_HTTP, VITE_VOICE_WS from root `.env`).

---

## 4. Gemini Voice Agent (gemini-voice-agent)

- [ ] **`GEMINI_VOICE_AGENT/app/.env`** exists with **`GEMINI_API_KEY`**.
- [ ] **`GEMINI_VOICE_AGENT/.env.docker`** exists with:
  - `RAG_BASE_URL=http://program-counsellor-backend:8080` (internal; same network)
  - `RAG_API_KEY=<same as backend-app/app/.env>`
  - `ALLOWED_ORIGINS=http://localhost:40090`

---

## 5. Keys must match

- [ ] **`RAG_API_KEY`** is identical in `backend-app/app/.env` and `GEMINI_VOICE_AGENT/.env.docker`.

---

## 6. Run (from repo root)

```bash
docker compose up --build
```

- **Frontend (browser):** http://localhost:40090  
- **Backend (health):** http://localhost:40080/health  
- **Voice agent (health):** http://localhost:40001/health  

Container-to-container: voice agent uses `http://program-counsellor-backend:8080` (no host ports).

---

## 7. If something fails

- **Voice agent tool calls / 401:** Ensure `RAG_API_KEY` matches in backend and voice `.env.docker`, and `RAG_BASE_URL=http://program-counsellor-backend:8080` (container name, not localhost).
- **CORS:** Backend `CORS_ORIGIN=http://localhost:40090`; voice `ALLOWED_ORIGINS=http://localhost:40090`.
