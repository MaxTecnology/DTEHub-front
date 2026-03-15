# Frontend Handoff - API DTE

Data base: 12 de marco de 2026.
Objetivo: entregar para o time/projeto de frontend um pacote claro para implementacao segura e previsivel.

## 1) Decisao de arquitetura

Decisao recomendada: frontend em repositorio separado da API.

Motivos:

1. isolamento de seguranca (PFX, sessao DTE e token interno ficam apenas no backend);
2. deploy e escala independentes;
3. ciclo de release do frontend sem risco de afetar integracao DTE;
4. fronteira de contrato clara via HTTP/OpenAPI.

## 2) Escopo que o frontend deve cobrir (MVP)

1. login/logout de usuario (Bearer);
2. dashboard operacional (saude DTE + resumo de nao lidas + ultimo sync);
3. lista de empresas com filtro por nao lidas;
4. lista de mensagens por empresa;
5. detalhe da mensagem sem marcar leitura no portal;
6. preview/download de documento;
7. tela de jobs de sync (status e erro);
8. telas administrativas por role (usuarios, certificados, alertas).

## 3) Documentos fonte obrigatorios

1. `docs/openapi-v1-inicial.json`
2. `docs/doc.http`
3. `docs/guia-rotas-api.md`
4. `docs/fluxo-aplicacao.md`
5. `docs/fase-09-users-auth.md`
6. `docs/fase-08-cert-vault.md`
7. `docs/runbook-operacao.md`
8. `docs/n8n-alerts.md`

## 4) Regras de seguranca para o frontend

1. frontend nunca usa `x-api-token`;
2. frontend usa apenas `Authorization: Bearer <token>`;
3. frontend nunca manipula PFX, senha de certificado ou chave de vault;
4. logout sempre chama `POST /v1/users/logout` e limpa sessao local;
5. em `401`, forcar relogin; em `403`, exibir acesso negado por role.

## 5) Contrato de autenticacao para o frontend

1. Login:
   - `POST /v1/users/login`
   - request: `{ "email": "...", "password": "..." }`
   - response: `accessToken`, `expiresAt`, `user`
2. Sessao atual:
   - `GET /v1/users/me`
3. Logout:
   - `POST /v1/users/logout`

Persistencia recomendada do token:

1. memoria (state global);
2. opcional: `sessionStorage` com renovacao por relogin.

## 6) Mapeamento de telas x endpoints

1. Login
   - `POST /v1/users/login`
   - `GET /v1/users/me`
2. Dashboard
   - `GET /v1/health/dte`
   - `GET /v1/ops/dashboard`
3. Empresas
   - `GET /v1/companies`
   - `GET /v1/companies?onlyWithUnread=true`
4. Mensagens por empresa
   - `GET /v1/companies/{contratoId}/messages`
   - `GET /v1/companies/{contratoId}/messages/unread`
5. Detalhe da mensagem
   - `GET /v1/companies/{contratoId}/messages/{messageId}`
   - `GET /v1/companies/{contratoId}/messages/{messageId}/view`
6. Documentos
   - `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}`
   - `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download?delivery=proxy`
   - `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download?delivery=proxy&format=base64`
7. Sync
   - `GET /v1/jobs?status=pending,running&jobType=sync_messages`
   - `POST /v1/sync/messages`
   - `GET /v1/jobs`
   - `GET /v1/jobs/{jobId}`
8. Alertas
   - `GET /v1/alerts/channels`
   - `POST /v1/alerts/channels` (admin/owner)
   - `POST /v1/alerts/test-delivery` (admin/owner)
   - `GET /v1/alerts/deliveries`
9. Usuarios
   - `GET /v1/users`
   - `POST /v1/users`
   - `PATCH /v1/users/{userId}/status`
   - `POST /v1/users/{userId}/reset-password`
   - `GET /v1/users/audit`
10. Certificados
   - `GET /v1/certificates`
   - `GET /v1/certificates/current`
   - `POST /v1/certificates/upload`
   - `POST /v1/certificates/{certificateId}/activate`
   - `POST /v1/certificates/{certificateId}/revoke`
   - `POST /v1/certificates/{certificateId}/test-login`

## 7) Matriz de permissao (RBAC)

1. `owner`
   - acesso total.
2. `admin`
   - operacao + usuarios + certificados + alertas mutaveis.
3. `operator`
   - consulta + sync + jobs + health + alertas leitura.
4. `viewer`
   - apenas leitura de empresas/mensagens/documentos/health.

## 8) Comportamento de UX por status HTTP

1. `200/201/202`
   - sucesso normal.
2. `401`
   - limpar sessao e redirecionar para login.
3. `403`
   - mensagem clara de permissao insuficiente.
4. `409`
   - estado de negocio conflitante (ex.: refresh DTE sem sucesso).
5. `502/503/504`
   - mostrar banner de instabilidade DTE e permitir reprocessar.

## 9) Fluxo de sync no frontend

1. frontend consulta `GET /v1/jobs?status=pending,running&jobType=sync_messages`;
2. se houver job ativo, reutiliza esse `jobId`;
3. se nao houver, usuario dispara `POST /v1/sync/messages`;
4. frontend consulta `GET /v1/jobs/{jobId}` em polling (2-5s);
5. ao `success`, recarrega empresas/mensagens;
6. ao `failed`, exibe `errorMessage` e link para metricas/health.

## 10) Checklist de entrega do frontend

1. autenticar com bearer e proteger rotas;
2. implementar guard de role por pagina/acao;
3. telas principais do MVP funcionando com dados reais;
4. fluxos de erro (401/403/409/502) tratados;
5. download de documento validado em `proxy`;
6. fluxo de sync com polling de job validado;
7. documentacao do frontend com setup e env;
8. smoke test manual com `docs/doc.http` como referencia.

## 11) Criterio de aceite para integracao front + API

1. login e sessao funcionam por bearer;
2. frontend lista empresas e mensagens sem usar token interno;
3. mensagem nao lida aparece com destaque visual consistente;
4. documento abre/baixa sem acionar leitura indevida no portal DTE;
5. usuario `viewer` nao consegue executar operacoes de mutacao;
6. dashboard sinaliza quando DTE estiver `DEGRADED` ou `DOWN`.


## 12) Alertas no frontend (n8n)

Objetivo do MVP de notificacoes:

1. permitir configurar um canal webhook do n8n;
2. permitir testar o canal sem depender de evento real do DTE;
3. permitir auditar entregas por canal.

Tela recomendada: `Configuracoes > Alertas`

Subsecoes:

1. `Canal n8n`
   - campos do formulario:
     - `name`
     - `endpointUrl`
     - `webhookToken` (write-only)
     - `hmacSecret` (write-only)
     - `enabled`
     - `timeoutMs`
     - `maxAttempts`
   - mapeamento para a API:
     - `secret = hmacSecret`
     - `headersJson["x-webhook-token"] = webhookToken`
     - `headersJson["X-Source"] = "dte-api"`
2. `Teste de entrega`
   - botao `Testar canal`
   - chama `POST /v1/alerts/test-delivery`
   - exibir retorno com:
     - `success`
     - `httpStatus`
     - `errorMessage`
     - `eventId`
     - `outboxId`
3. `Historico de entregas`
   - usar `GET /v1/alerts/deliveries`
   - suportar filtro por `channelId`

Regras importantes para o frontend:

1. `headersJson` retornado pela API pode vir com valores sensiveis mascarados como `[REDACTED]`;
2. o frontend nao deve tentar reutilizar o valor mascarado em formularios de edicao;
3. `webhookToken` e `hmacSecret` devem ser tratados como campos write-only;
4. ao editar um canal no futuro, o frontend deve pedir reentrada do segredo se houver alteracao.

## 13) Contatos de notificacao (proximo passo recomendado)

Para notificacoes por email/WhatsApp via n8n, o sistema precisa de um cadastro de destinos.

Decisao recomendada:

1. curto prazo: manter destinatarios dentro do workflow do n8n para acelerar a entrada em producao;
2. proximo passo profissional: criar no backend um modulo proprio de `destinatarios de notificacao`.

Modelo recomendado para esse modulo futuro:

1. escopo por empresa (`contratoId`) ou global;
2. tipos de destino:
   - `email`
   - `whatsapp`
3. campos minimos:
   - `name`
   - `contratoId` (opcional para regra global)
   - `email` (opcional)
   - `phoneNumber` (opcional)
   - `enabled`
   - `preferredChannels`
4. frontend deve prever uma tela futura:
   - `Configuracoes > Destinatarios`

Enquanto esse modulo nao existir na API, o front deve considerar que:

1. o cadastro do canal n8n fica na API;
2. a decisao de para quem enviar ainda fica dentro do n8n.

