# Docker and environment setup

## Architecture

- **Root** `docker-compose.yml`: orchestrates backend, frontend, and Gemini Voice Agent on a **single shared network** `rag-network`.
- **Root** `.env`: host port mapping only (no secrets). Used by `docker-compose` for variable substitution.
- **Per project**: `.env.local` (run on host) and `.env.docker` (run in containers). Secrets stay in each project’s env files.

### Why a shared network?

Containers on **different** Docker networks cannot resolve or reach each other by container name. If each service had its own network, the Gemini Voice Agent could not call the RAG backend by name; tool calls would fail. With **one** network (`rag-network`), all three containers can resolve:

- Backend: `http://program-counsellor-backend:8080`
- Voice agent: `http://gemini-voice-agent:3001`, `ws://gemini-voice-agent:3002`

### Internal ports vs host ports

- **Internal (container-to-container):** Use **container name + internal port** only (e.g. `program-counsellor-backend:8080`). No host ports; no `localhost` inside the network.
- **Host ports (browser):** Exposed only so the **browser** can reach services. Frontend is built with host URLs (e.g. `http://localhost:40080`, `ws://localhost:40002`) so the user opens `http://localhost:40090` and the app can call backend and voice agent.

## Local vs Docker

### Local mode (run on host)

- All services use **localhost** and **local ports** (backend 8080, frontend 5173, voice HTTP 3001, voice WS 3002).
- Each app loads **`.env.local`** first, then `.env` (so `.env` can override for secrets).
- **Backend**: from `backend-app/app/`, run `npm run dev`. CORS expects frontend at `http://localhost:5173` (set in `app/.env.local`).
- **Frontend**: from `frontend-app/app/`, run `npm run dev`. Vite reads `app/.env.local` (and `.env`). API and voice URLs point to localhost.
- **Voice agent**: from `GEMINI_VOICE_AGENT/app/`, run `npm run dev`. `RAG_BASE_URL=http://localhost:8080`, `ALLOWED_ORIGINS` includes `http://localhost:5173`.

### Docker mode

- **Backend** talks to **Voice agent** by **service name**: `http://gemini-voice-agent:3001`, `ws://gemini-voice-agent:3002`.
- **Voice agent** talks to **backend** by **service name**: `http://program-counsellor-backend:8080`.
- **Browser** uses **host ports** only: backend 40080, frontend 40090, voice HTTP 40001, voice WS 40002 (from root `.env`).
- Root: `docker compose up --build`. Compose injects env from each project’s `.env.docker` (and optionally `app/.env` for secrets).
- Frontend build gets `VITE_*` from root `.env` via build args so the built app uses host URLs (e.g. `http://localhost:40080`, `ws://localhost:40002`).
- Voice agent gets `HTTP_BASE_URL` and `WS_BASE_URL` from compose so `/api/config` returns browser-usable URLs (e.g. `http://localhost:40001`, `ws://localhost:40002`).

## Port mapping

| Service              | Internal port | Host port (from root `.env`) |
|----------------------|---------------|-----------------------------|
| program-counsellor-backend | 8080          | 40080                       |
| program-counsellor-frontend | 5173          | 40090                       |
| gemini-voice-agent   | 3001 (HTTP), 3002 (WS) | 40001, 40002         |

## Env files per project

| Project              | `.env.local` (host) | `.env.docker` (containers) |
|----------------------|----------------------|----------------------------|
| backend-app          | `backend-app/app/.env.local` (CORS, PORT) | `backend-app/.env.docker` (CORS for 40090). Compose also loads `backend-app/app/.env` for secrets. |
| frontend-app         | `frontend-app/app/.env.local` (VITE_* localhost) | `frontend-app/app/.env.docker` (VITE_* host ports). Build args override URLs when building in Docker. |
| GEMINI_VOICE_AGENT   | `GEMINI_VOICE_AGENT/app/.env.local` (RAG_BASE_URL=localhost:8080, ALLOWED_ORIGINS) | `GEMINI_VOICE_AGENT/.env.docker` (RAG_BASE_URL=program-counsellor-backend:8080). Compose loads `app/.env` for GEMINI_API_KEY; overrides HTTP_BASE_URL/WS_BASE_URL for browser. |

## Voice streaming and tool calling

1. **Browser** loads frontend (e.g. `http://localhost:40090` in Docker) and gets voice HTTP/WS URLs from env (or `/api/config` if used).
2. **Frontend** opens WebSocket to voice agent (host 40002 in Docker).
3. **Voice agent** receives audio, uses Gemini Live; when the model calls `cohort_chat`, the agent calls **RAG backend** at `http://program-counsellor-backend:8080/api/chat/cohort/:cohortKey` with `Authorization: Bearer RAG_API_KEY`.
4. **Backend** responds with `{ answer }`; voice agent speaks it. No hardcoded localhost in services; all URLs come from env.

## Quick start (Docker)

1. Copy root `.env.example` to `.env` and set host ports if needed.
2. Ensure `backend-app/app/.env` and `GEMINI_VOICE_AGENT/app/.env` exist (secrets). Ensure `backend-app/.env.docker` has at least `PORT=8080` and `CORS_ORIGIN=http://localhost:40090`.
3. Run: `docker compose up --build`.
4. Open frontend at `http://localhost:40090`; backend at `http://localhost:40080`; voice at `http://localhost:40001`.

## Quick start (local)

1. In each project use `.env.local` (and keep `.env` for secrets where needed).
2. Start backend: `cd backend-app/app && npm run dev`.
3. Start voice agent: `cd GEMINI_VOICE_AGENT/app && npm run dev`.
4. Start frontend: `cd frontend-app/app && npm run dev`.
5. Open frontend at `http://localhost:5173`; backend at `http://localhost:8080`; voice at `http://localhost:3001`.
