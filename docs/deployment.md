# Execução e implantação

## Requisitos
- Node.js ≥ 22 (desenvolvido com 24) e npm.
- Binário do PocketBase 0.40.4 (`npm run setup` baixa para `backend/bin`).

## Primeira execução (desenvolvimento)
```bash
# 1. dependências
cd backend && npm install && npm run setup && cd ..
cd web && npm install && cd ..

# 2. configuração local
cp backend/.env.example backend/.env   # defina KAMBAN_ADMIN_EMAIL e KAMBAN_ADMIN_PASSWORD

# 3. super administrador (aplica as migrations antes)
npm --prefix backend run create-admin

# 4. subir tudo (API em :8090 e web em :5173)
npm run dev
```
Acesse http://localhost:5173.

### Usuário root (SUPER_ADMIN) e superusuário do painel
- **SUPER_ADMIN da aplicação:** defina `KAMBAN_ADMIN_EMAIL`, `KAMBAN_ADMIN_PASSWORD` e `KAMBAN_ADMIN_NAME` em `backend/.env` e rode `npm --prefix backend run create-admin`. Se o e-mail já existir, nome e senha são atualizados e o perfil SUPER_ADMIN é garantido.
- **Superusuário do painel do PocketBase** (http://127.0.0.1:8090/_/ — acesso direto ao banco): defina também `KAMBAN_SUPERUSER_EMAIL` e `KAMBAN_SUPERUSER_PASSWORD` antes de rodar o mesmo comando.

## Build de produção
```bash
npm --prefix web run build     # gera backend/pb_public
```
O PocketBase serve o frontend e a API na mesma origem (SPA com fallback para `index.html` e CSP aplicada pelos hooks).

Antes de publicar: `npm run check` (lint, tipos, unitários e API) e `npm run e2e` (gera o build e roda os testes de ponta a ponta no navegador contra ele). Checklist de produção em [security.md](security.md#produção-checklist).

## Produção
```bash
KAMBAN_ENV=production ./bin/pocketbase serve \
  --http=127.0.0.1:8090 \
  --dir=/var/lib/kamban/pb_data \
  --hooksDir=./pb_hooks --migrationsDir=./pb_migrations --publicDir=./pb_public \
  --origins=https://kamban.suaempresa.com
```
- Coloque um proxy reverso com **HTTPS** (Caddy/Nginx) na frente e configure *Trusted proxy* no painel.
- Migrations rodam automaticamente no `serve`.
- Backup: diretório `pb_data` (ou backups agendados no painel).
- Variáveis: ver `backend/.env.example` e [security.md](security.md).
- Health check: `GET /api/v1/health` (200 ok / 503 degradado).

## Observabilidade
- Logs estruturados do PocketBase (painel → Logs), com `correlationId`, método, caminho e status nos erros da API.
- Toda resposta traz `X-Correlation-Id`; o frontend mostra a referência em estados de erro para o suporte localizar o log.
- Auditoria de negócio em `audit_logs`.
