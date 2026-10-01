# KAMBAN — imagem de produção: o PocketBase serve a API (/api/v1) e o web já compilado.
#   docker compose up -d           (ver docker-compose.yml)
#   docker build -t kamban .       (imagem avulsa)

# --- 1. build do web (grava em backend/pb_public)
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN mkdir -p /src/backend && npm run build

# --- 2. binário do PocketBase (versão fixada do projeto)
FROM alpine:3.20 AS pocketbase
ARG PB_VERSION=0.40.4
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /pb \
 && chmod +x /pb/pocketbase

# --- 3. imagem final (sem Node, sem root)
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget \
 && adduser -D -u 1000 kamban \
 && mkdir -p /pb_data \
 && chown kamban /pb_data
WORKDIR /app
COPY --from=pocketbase /pb/pocketbase /app/pocketbase
COPY backend/pb_hooks /app/pb_hooks
COPY backend/pb_migrations /app/pb_migrations
COPY --from=web /src/backend/pb_public /app/pb_public
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
USER kamban
ENV KAMBAN_ENV=production \
    KAMBAN_HTTP=0.0.0.0:8090
VOLUME ["/pb_data"]
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:8090/api/v1/health >/dev/null || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
