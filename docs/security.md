# Segurança

> Diretriz §27, §28 e §32. Toda regra aqui tem teste unitário ou de API correspondente (ver [testing.md](testing.md)).

## Superfície exposta
- Apenas `/api/v1` é usada pela aplicação. A API genérica do PocketBase tem todas as regras nulas e o login por senha nativo desativado — nenhum dado sai por `/api/collections/*` sem superusuário (teste de API).
- O painel `/_/` do PocketBase é administrativo (superusuário). Em produção, restrinja o acesso por rede/proxy.

## Autenticação e sessão
- Senhas: bcrypt (PocketBase). Política: 10–72 caracteres, com letras e números (validada no backend e no formulário).
- Falha de login responde `INVALID_CREDENTIALS` genérico (não revela se o e-mail existe) e gera auditoria `auth.login_failed`.
- Conta desativada: só informa `ACCOUNT_DISABLED` depois da senha correta; desativar revoga todas as sessões na hora.
- **Bloqueio progressivo de conta (Fase 9, [ADR-020](decisions.md#adr-020--bloqueio-progressivo-por-conta-com-chave-anônima)):** 5 falhas de login para o mesmo e-mail (em 24 h) bloqueiam novas tentativas por 5 min; a cada 5 novas falhas o tempo dobra (10, 20, 40) até 60 min. Vale também para e-mails inexistentes (não revela quais existem). Durante o bloqueio a API responde `429 ACCOUNT_LOCKED` com `retry_after_seconds`, sem conferir a senha, e a tentativa bloqueada não conta. Login correto zera o contador. As tentativas ficam em `login_attempts` pelo SHA-256 do e-mail normalizado (nunca o e-mail em claro) e são limpas todo dia às 03:30 (mais de 24 h). Auditoria `auth.login_locked` para contas existentes. Complementa o rate limit por IP.
- Sessão opaca ([ADR-004](decisions.md#adr-004--sessão-opaca-em-cookie-httponly)):
  - token aleatório de 48 caracteres; banco guarda só o SHA-256;
  - cookie `kb_session`: `HttpOnly`, `SameSite=Strict`, `Path=/api/`, `Secure` em produção;
  - expiração absoluta: 12h (comum) ou 30 dias ("lembrar-me"); inatividade: 120 min (comum); renovação deslizante para persistentes;
  - cookie inválido/expirado é limpo automaticamente e a API responde `SESSION_EXPIRED`;
  - o frontend verifica a sessão a cada 5 min e ao focar a janela, limpa o cache e volta ao login.
- Variáveis: `KAMBAN_SESSION_TTL_HOURS`, `KAMBAN_SESSION_REMEMBER_DAYS`, `KAMBAN_SESSION_IDLE_MINUTES`, `KAMBAN_SESSION_TOUCH_SECONDS`.

## CSRF, XSS e cabeçalhos
- CSRF: `SameSite=Strict` + header `X-Requested-With: kamban` obrigatório em mutações (inclusive no login).
- XSS: React escapa a saída; nenhum `dangerouslySetInnerHTML`; nenhum token acessível ao JavaScript.
- CSP no frontend servido pelo PocketBase: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-ancestors 'none'; object-src 'none'…` (`'unsafe-inline'` em estilos é exigido por atributos `style` dos componentes; scripts inline não são usados — o tema inicial é aplicado por `public/theme-init.js`).
- Também: `Referrer-Policy`, `Permissions-Policy`, e os padrões do PocketBase (`X-Content-Type-Options`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`). API com `Cache-Control: no-store`.
- Redirecionamento pós-login só aceita caminhos internos (`safeRedirect`, contra open redirect).

## Autorização (RBAC) e IDOR
- Toda rota verifica permissão no backend; a UI só esconde/desabilita.
- Ordem de verificação: usuário autenticado → permissão → existência → regras de domínio.
- Recursos de outros usuários (ex.: sessões) respondem **404**, não 403 (não confirmam existência).
- Anti-escalonamento: ninguém concede permissões que não tem, atribui perfil com permissões que não tem, altera o próprio perfil ou mexe no SUPER_ADMIN (sem ser SUPER_ADMIN). Ver [permissions.md](permissions.md).

## Entrada e saída
- Validação declarativa em todas as rotas; campos desconhecidos são ignorados (lista explícita de campos aceitos).
- Ordenação só por whitelist; filtros via parâmetros vinculados (`{:param}` / `$dbx`) — sem SQL concatenado com entrada do usuário.
- Corpo JSON ≤ 1 MB; JSON inválido → `BAD_REQUEST`.
- Erros inesperados nunca expõem mensagem interna; são logados com correlation id.

## Anexos e conteúdo do usuário (Fase 4)
- **Tipo real pelo conteúdo, nunca só pela extensão:** `domain/attachment.js` lê os primeiros bytes (assinaturas PNG/JPEG/GIF/WebP/PDF/ZIP/OLE; texto só sem bytes nulos) e exige que batam com a extensão. Segunda barreira: o campo de arquivo do PocketBase tem lista de tipos permitidos e detecta o tipo pelo conteúdo (ex.: HTML num `.txt` é recusado).
- **Proibidos:** SVG, HTML, executáveis e qualquer tipo fora da lista. Até 20 MB por arquivo; uma requisição de upload por arquivo (limite de corpo 21 MB).
- **Nome seguro:** só o nome base, sem caminhos nem caracteres de controle, até 150 caracteres.
- **Download protegido:** o campo é `protected` e a API genérica está fechada; o arquivo só sai por `/api/v1/attachments/{id}/file`, que confere o acesso ao projeto (404 para quem não vê). Resposta com `X-Content-Type-Options: nosniff`, CSP `sandbox` e `Cache-Control: private, no-store`; `?download=1` força download.
- **Markdown seguro:** descrições e comentários são renderizados como elementos React (`AppMarkdown`), sem HTML cru; links só `http(s)`. Campos URL também só `http(s)`.
- **Menções:** o servidor aceita só pessoas ativas com acesso ao projeto.
- **Notificações:** só chegam a quem continua com acesso ao projeto e está ativo; cada pessoa lê e marca apenas as suas (as de outra pessoa respondem 404). O texto exibido é guardado na notificação; clicar abre a tarefa, que confere o acesso de novo.

## Rate limiting
Regras do PocketBase (seed): login 10/min por IP; `/api/v1/` 600/min; `/api/` 300/10s. Respostas `429 RATE_LIMITED` no envelope padrão. Ajustável no painel `/_/` → Settings.

## Segredos e configuração
- Nenhum segredo no código ou no frontend. Configuração por variáveis de ambiente (`backend/.env`, não versionado — modelo em `.env.example`).
- O super administrador é criado por `npm run create-admin` a partir de `KAMBAN_ADMIN_*` (a senha não passa pela linha de comando).
- Logs sem senhas/tokens; o user agent é truncado.

## Produção (checklist)
- [ ] HTTPS obrigatório (proxy reverso) e `KAMBAN_ENV=production` (cookie `Secure`).
- [ ] Configurar *Trusted proxy* no PocketBase para o IP real (rate limit e auditoria).
- [ ] Restringir `/_/` e fazer backup de `pb_data`.
- [ ] `--origins` do PocketBase restrito ao domínio do app.
- [ ] `npm run check` e `npm run e2e` verdes no build que será publicado.
- [ ] (Opcional) Antivírus para anexos (ex.: ClamAV no proxy de upload) — os anexos já têm tipo conferido pelo conteúdo, limite de tamanho e download protegido.

## Verificações automatizadas (Fase 9)
- **Varredura de segurança** (`tests/api/security-sweep.test.js`): lê todas as rotas registradas em `main.pb.js` e exige **401 sem sessão** em todas (exceto as públicas), **CSRF** em todas as mutações, a API genérica fechada nas 24 collections e os cabeçalhos de segurança. Rota nova entra na varredura sozinha.
- **Catálogo de auditoria** (`tests/unit/audit-catalog.test.js`): toda ação gravada em `audit_logs` precisa de rótulo nos três idiomas e aparecer no filtro da auditoria.
- **Bloqueio de conta** (`tests/unit/application-lockout.test.js`, `tests/api/lockout.test.js`).
- **Dependências:** `npm audit` sem vulnerabilidades na raiz, em `web/` e em `backend/` (2026-09-30).
- **Navegador** ([testing.md](testing.md#ponta-a-ponta-fase-9)): fluxos do MVP, leitor sem edição, sessão encerrada em outro lugar e varredura de acessibilidade.

## Configurador geral
- **Bloqueio de login e política de senha configuráveis** com limites que não deixam desligar a proteção (mínimo de 3 tentativas; senha de 8+ caracteres sempre com letras e números; teto do bloqueio ≥ tempo inicial). A política de senha vale em criação, redefinição e troca; o bcrypt continua limitando a 72 caracteres.
- **Imagens da identidade** (logo/ícone): até 1 MB, tipo conferido pelo conteúdo (PNG, JPEG, WebP, ICO); **SVG** só sem conteúdo ativo — recusado se tiver `<script>`, atributos `on*`, `foreignObject`/`iframe`/`embed`/`object`, `DOCTYPE`/`ENTITY`, `javascript:`, `@import` ou referências externas (só âncoras `#` e `data:image/`). Servidas com `X-Content-Type-Options: nosniff` e `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` (segunda barreira se aberto direto no navegador); na tela entram por `<img>`, que não executa script.
- **Rotas públicas novas:** só `GET /api/v1/platform` (nome e endereços) e as imagens — sem dados de configuração. Rotas públicas **não limpam** o cookie de uma sessão inválida (só as protegidas, que respondem `SESSION_EXPIRED`): a identidade carrega junto com o `/auth/me`, e limpar antes faria a tela perder o aviso "Sua sessão expirou". A varredura de segurança (`security-sweep.test.js`) as trata como públicas; todo o resto continua exigindo sessão.
- **Retenção do histórico:** limpeza diária com registro da própria limpeza; encurtar o prazo exige confirmação na tela com a contagem do que sairá.

## E-mail e links de senha
- **Links de uso único:** token aleatório de 48 caracteres; só o **hash** vai para o banco (`auth_tokens`). Redefinição vale 60 minutos; convite, 7 dias; usar ou pedir outro invalida. Confirmar a nova senha **encerra todas as sessões** e libera o bloqueio de login.
- **Sem enumeração de contas:** o pedido de redefinição responde sempre `{ requested: true }`, exista ou não a conta, esteja ou não ativa; no máximo 3 pedidos por conta por hora (além do rate limit por IP).
- **Sem envenenamento de link:** os links usam o **endereço da plataforma configurado**, nunca o `Host` da requisição.
- **Senha do SMTP:** só escrita — nunca volta na API nem vai para o histórico. Para cifrar as configurações do PocketBase em repouso, suba com `--encryptionEnv=PB_ENCRYPTION_KEY` (32 caracteres).
- **Fila sem segredos guardados:** o corpo do e-mail (que pode ter um link) é apagado depois de enviado ou desistido; a lista da fila mostra só destinatário, tipo, assunto e situação.
- **Conteúdo:** todo texto vindo de pessoas é escapado no HTML do e-mail.

## Tokens de API
- Valor `kb_pat_` + 40 caracteres aleatórios; só o **hash** fica no banco e o valor aparece uma vez. O histórico guarda nome, prefixo e prazo, nunca o valor.
- `Authorization: Bearer` não usa cookie, então não há CSRF a proteger: o header de CSRF é dispensado só nesse caso, e com o token o cookie é ignorado (não dá para combinar os dois).
- O token herda as permissões do perfil atual a cada chamada; pessoa desativada, token vencido ou revogado → 401 imediato.
- Um token vazado não consegue se perpetuar: não cria outros tokens, não troca a senha nem mexe nas sessões (`TOKEN_NOT_ALLOWED`). Revogar está em Minha conta e, para o Admin, em Integrações.

## Webhooks
- **Só para quem administra** (`integrations.manage`): um webhook recebe eventos de todos os projetos.
- **SSRF:** endereço https obrigatório em produção; metadados da nuvem (`169.254.0.0/16`, `metadata.google.internal`), link-local e `0.0.0.0` sempre recusados; a própria máquina (`localhost`, `127.*`, `::1`) e http só fora de produção ou com `KAMBAN_WEBHOOKS_ALLOW_INSECURE=true`. Credenciais no endereço são recusadas. Limitação conhecida: um nome de domínio que resolva para um IP interno não é bloqueado (o JSVM não resolve DNS) — por isso o recurso é restrito a administradores. Tempo limite de 10 s por envio.
- **Autenticidade:** cada envio é assinado com HMAC-SHA256 (`X-Kamban-Signature`) sobre `timestamp.corpo`; o receptor deve conferir a assinatura e recusar timestamps antigos (proteção contra repetição). O segredo aparece uma vez e pode ser trocado a qualquer momento.
- **Conteúdo:** a carga é o que o histórico já guarda (sem senhas nem tokens).

## Tempo real
- Assinar tópicos (`POST /api/realtime`) exige a sessão do cookie e o header de CSRF; a conexão fica presa à pessoa (outra sessão não reaproveita o `clientId`). Tópicos só de projetos visíveis e do próprio usuário; o resto é descartado.
- Os avisos carregam só identificadores; o conteúdo sempre vem da API, com as permissões. Limitação conhecida: quem perde o acesso a um projeto com a tela aberta ainda pode receber os identificadores das mudanças até a conexão ser refeita — nunca o conteúdo.
- O painel do PocketBase (superusuário com o token dele) segue as regras nativas; as coleções continuam sem regras de API, então assinaturas nativas de coleção não entregam nada a usuários comuns.
