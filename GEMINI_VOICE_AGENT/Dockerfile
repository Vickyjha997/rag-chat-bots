FROM node:24-alpine AS builder
RUN apk add --no-cache curl

WORKDIR /app

COPY app/package.json .
COPY app/package-lock.json .
RUN npm install

COPY app .

RUN npm run build
    

FROM node:24-alpine AS runner

WORKDIR /app

# Copy built application
COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .
RUN npm install

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

CMD ["npm", "start"]