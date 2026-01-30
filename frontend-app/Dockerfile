# Step 1: Build the app
FROM node:24-alpine AS builder

WORKDIR /app

COPY app/package*.json ./
RUN npm install --force

COPY app .
RUN npm run build

# Step 2: Production image
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm install --force --omit=dev

COPY --from=builder /app/dist ./dist


EXPOSE 5173

# Serve static assets on port 5173 to match docker-compose mapping
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]