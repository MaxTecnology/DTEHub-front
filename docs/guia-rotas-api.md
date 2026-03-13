# Guia de Rotas - Operacao da API

Data base: 11 de marco de 2026.
Objetivo: executar a API por rotas, com login/sessao DTE e sincronizacao de mensagens.

## 1. Pre-requisitos

1. Infra local ativa:
   - `npm run infra:up`
2. API ativa:
   - `npm run api:serve`
3. Token da API configurado em `.env` (modo interno/admin):
   - `API_INTERNAL_TOKEN`
4. Auth de usuario (fase 9):
   - `POST /v1/users/login` gera `Bearer <token>`
   - usar bearer nas rotas protegidas de consulta/operacao conforme role
5. Para refresh automatico de sessao via PFX:
   - `DTE_AUTH_PROVIDER=auto` ou `pfx`
   - se usar fonte `env`: `CERT_PFX_PATH` e `CERT_PFX_PASSWORD`
   - se usar fonte `db`: `CERT_VAULT_MASTER_KEY_BASE64` e certificado ativo em `/v1/certificates/*`
   - `DTE_AUTH_CERT_SOURCE=auto|env|db`
6. Para cache/download via MinIO (fase 7):
   - `OBJECT_STORAGE_ENABLED=true`
   - `OBJECT_STORAGE_PROVIDER=minio`
   - `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`
   - `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
   - `MINIO_BUCKET`, `MINIO_PRESIGNED_TTL_SECONDS`

## 2. Ordem de chamadas recomendada

1. Validar API online:
   - `GET /v1/health/live`
   - esperado: `200`
2. Login de usuario (frontend) ou usar token interno:
   - `POST /v1/users/login`
   - esperado: `200` com `accessToken`
3. Verificar status da sessao DTE:
   - `GET /v1/auth/status`
   - esperado: `200`
4. Se `authenticated=false`, tentar renovar sessao:
   - `POST /v1/auth/refresh`
   - header obrigatorio: `Content-Type: application/json`
   - body: `{}`
   - esperado: `200` (renovou) ou `409` (nao conseguiu automaticamente)
5. Gerenciar certificado (quando usar vault em banco):
   - `GET /v1/certificates/current`
   - `POST /v1/certificates/upload` (multipart recomendado: arquivo `.pfx` + senha)
   - `POST /v1/certificates/{certificateId}/test-login`
   - esperado: `201/200`
6. Disparar sincronizacao:
   - `POST /v1/sync/messages`
   - body geral: `{ "dryRun": false }`
   - esperado: `202` com `data.jobId`
7. Acompanhar job:
   - `GET /v1/jobs/{jobId}`
   - esperado: `200` com status `pending|running|completed|failed`
8. Consultar dados persistidos:
   - `GET /v1/companies`
   - `GET /v1/companies/{contratoId}/messages`
   - `GET /v1/companies/{contratoId}/messages/{messageId}`
   - `GET /v1/companies/{contratoId}/messages/{messageId}/view`
   - `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}`
   - `POST /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/cache`
   - `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download`
   - `GET /v1/companies/{contratoId}/messages/unread`
   - `GET /v1/events/unread`

## 3. Fluxo sem usar DTE_TARGET_IDS_CSV

1. Rode sync geral com body:
   - `{ "dryRun": false }`
2. Pegue `contratoId` real em `GET /v1/companies`.
3. Use esse `contratoId` nas rotas de mensagens.

Observacao:

- `targetIds` em `POST /v1/sync/messages` e opcional e serve para sync pontual.

## 4. Codigos de retorno importantes

1. `401`:
   - token interno ou bearer ausente/invalido/expirado.
2. `403`:
   - usuario autenticado sem role suficiente.
3. `409` em `/v1/auth/refresh`:
   - sessao nao foi renovada automaticamente; revisar PFX/config.
4. `400` em `/v1/certificates/upload`:
   - erro de validacao no arquivo/senha/chave de criptografia.
5. `202` em `/v1/sync/messages`:
   - job aceito (nao finalizado).
6. `200` em `/v1/jobs/{jobId}` com `status=failed`:
   - job executou e falhou; validar `errorMessage`.

## 5. Arquivo pronto para teste manual

Use o arquivo:

- `docs/doc.http`

Ele ja contem:

1. variaveis (`@baseUrl`, `@apiToken`, `@contratoId`, `@jobId`);
2. ordem operacional das rotas;
3. exemplos de payload para sync geral e sync por alvo.

## 6. Troubleshooting rapido

1. Job `failed` com erro de timeout:
   - exemplo: `The operation was aborted due to timeout`
   - acao:
     - aumentar `DTE_HTTP_REQUEST_TIMEOUT_MS` (ex.: `30000` ou `45000`)
     - manter retry habilitado (`DTE_HTTP_RETRY_MAX_ATTEMPTS >= 3`)
     - reexecutar `POST /v1/sync/messages`
2. Diagnosticar endpoint que falhou:
   - consultar `GET /v1/metrics/dte-http`
   - verificar contadores de `failuresTimeout` e circuitos com falha recente.
3. Quando o DTE estiver instavel:
   - priorizar sync por lote menor com `maxCompanies`
   - repetir depois sync geral quando a saude estabilizar (`GET /v1/health/dte`).
4. Download de documento com `401`:
   - confirmar sessao com `GET /v1/auth/status`;
   - chamar `POST /v1/auth/refresh` se necessario;
   - repetir download.
   - observacao: a API agora seta `contratoHonorarioAtivo` antes do download para reduzir `401`.

## 7. Regra de leitura (operacional)

1. As rotas `/messages/{messageId}` e `/messages/{messageId}/view` leem somente dados persistidos no banco.
2. A rota `/documents/{documentoId}/download` busca o anexo diretamente no DTE sem abrir a tela de leitura do portal.
   - para debug em cliente `.http`, use `?format=base64` e reconstrua o arquivo localmente.
3. Mesmo assim, o impacto em `read_state` deve ser validado empiricamente no seu ambiente:
   - capturar estado antes (`GET /messages/unread`);
   - baixar anexo;
   - rodar novo sync;
   - confirmar se houve mudanca de `nao_lida` para `lida`.

## 8. Contrato MinIO (fase 7 base)

Estas rotas ja estao implementadas na base da fase 7 e exigem `OBJECT_STORAGE_ENABLED=true`:

1. `POST /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/cache`
2. `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}`
3. `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download?delivery=proxy|redirect`

Referencia completa:

- `docs/fase-07-minio-document-cache.md`
