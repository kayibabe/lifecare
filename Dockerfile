# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .

# VITE_BACKEND_URL is a build-time arg — set it as a Railway service variable
# (Settings → Variables) on the frontend service to the backend service's
# public URL, e.g. https://lifecare-api.up.railway.app/api/v1
ARG VITE_BACKEND_URL=/api/v1
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx-railway.conf.template /etc/nginx/nginx.conf.template
COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Railway assigns the actual port via $PORT at runtime; 8080 is just the
# documented default for local `docker run`.
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
