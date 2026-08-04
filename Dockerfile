# ── as-built-backend/Dockerfile ────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Installation des dépendances
RUN npm ci

COPY . .

# ── Image finale ────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

EXPOSE 5000

# ✅ node directement — pas nodemon en prod
CMD ["node", "server.js"]