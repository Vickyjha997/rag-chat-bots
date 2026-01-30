# Step 1: Build the app (VITE_* from build args or .env.docker)
FROM node:24-alpine AS builder

ARG VITE_API_BASE
ARG VITE_VOICE_HTTP
ARG VITE_VOICE_WS
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_VOICE_HTTP=$VITE_VOICE_HTTP
ENV VITE_VOICE_WS=$VITE_VOICE_WS

WORKDIR /app

COPY app/package*.json .
RUN npm install --force

COPY app/ .
# Docker build: use .env.docker so host-port URLs and paths are baked in (build args override URLs).
RUN cp .env.docker .env 2>/dev/null || true
RUN npm run build

# Step 2: Production image
FROM node:22-alpine


WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm install --force --omit=dev

COPY --from=builder /app/dist ./dist


EXPOSE 5173

# Serve static assets on port 5173 to match docker-compose mapping
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]