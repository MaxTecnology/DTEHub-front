# Produto API DTE - Base de Conhecimento v1.1

Data de consolidacao: 10 de marco de 2026.
Objetivo: transformar o aprendizado tecnico em especificacao de produto API, com foco critico em mensagens nao lidas.

## 1) Problema de negocio

O problema mais critico nao e apenas coletar mensagens. O problema critico e detectar rapidamente mensagens nao lidas e notificar usuarios responsaveis por empresa.

Objetivos de negocio:

- centralizar mensagens do DTE em API;
- identificar status de leitura por mensagem e por empresa;
- notificar novo nao lido com baixa latencia;
- monitorar indisponibilidade do DTE e alertar operacao.

## 2) Fatos tecnicos ja validados

1. Login manual com extensao Web PKI funciona.
2. Reuso de sessao fora do browser funciona com `storage-state` e cookies.
3. Login sem browser via `.pfx` foi validado em condicao normal.
4. Para consultar dados, pode ser necessario definir `contratoHonorarioAtivo`.
5. O endpoint `Exped` retorna mensagens por empresa (apos trocar contrato ativo).
6. Extracao por empresa com paginacao de `Exped` ja esta implementada.
7. Em 10 de marco de 2026 houve erro `502` em endpoints de login/ping, logo indisponibilidade e requisito de produto.

## 3) Mapa de endpoints conhecidos

Autenticacao e sessao:

- `GET /dte/login/?redirect=...`
- `POST /dte/api/autenticacao-certificado`
- `POST /dte/api/v1/user/ping`

Contexto de empresa:

- `GET /dte/api/v1/agentes/me`
- `GET /dte/api/v1/agentes/me/contratosHonorarios`
- `PUT /dte/api/v1/agentes/me/contratoHonorarioAtivo`

Mensagens:

- `POST /dte/api/process/Exped`
- acao conhecida: `ConsultarExpedientesRecebidos`

## 4) Regra critica de leitura (produto)

Status de leitura precisa virar regra explicita de dominio.

Regra proposta v1:

1. `nao_lida`: existe destinatario da empresa com `dataLeitura` vazio/nulo.
2. `lida`: `dataLeitura` preenchido para o destinatario da empresa.
3. `desconhecida`: payload sem informacao suficiente para decidir.

Observacao:

- a implementacao deve guardar tambem os campos brutos para auditoria, pois pode haver variacoes de estrutura no payload.

## 5) Requisito de notificacao (SLA de produto)

1. Detectar novo nao lido em ate 60 segundos apos sincronizacao.
2. Evitar spam com deduplicacao por `empresa + messageId + estado`.
3. Reenviar alerta quando:
   - mensagem continua nao lida por janela configuravel (ex.: 4h, 24h);
   - mudanca de estado (`nao_lida -> lida` ou `lida -> nao_lida`).
4. Registrar tudo em trilha de auditoria.

## 6) Arquitetura recomendada

Componentes:

1. `api-service`
   - consulta mensagens e estados de leitura;
   - consulta saude do DTE;
   - exposicao para integracoes.
2. `sync-worker`
   - autentica, troca empresa e coleta `Exped`;
   - normaliza estado de leitura;
   - persiste bruto + normalizado.
3. `unread-detector`
   - compara snapshot atual x snapshot anterior;
   - gera eventos `new_unread`, `still_unread`, `read_now`.
4. `alert-worker`
   - dispara webhook/email/WhatsApp;
   - controla retentativas e deduplicacao.
5. `health-monitor`
   - checks ativos nos endpoints criticos;
   - classifica estado `UP`, `DEGRADED`, `DOWN`, `RECOVERED`.
6. `postgres`
   - entidades de negocio, eventos e auditoria.
7. `redis`
   - fila de jobs e controle de concorrencia.

## 7) Modelo de dados minimo (normalizado)

Empresa:

- `contratoId`
- `documento`
- `descricao`
- `tipo`
- `situacao`

Mensagem:

- `messageId`
- `contratoId`
- `assunto`
- `descricao`
- `data`
- `statusOriginal`
- `readState` (`nao_lida`, `lida`, `desconhecida`)
- `readAt` (timestamp)
- `firstSeenAt`
- `lastSeenAt`
- `unreadSince`
- `hasResponses`
- `documentsCount`

Evento de leitura:

- `eventId`
- `contratoId`
- `messageId`
- `eventType` (`new_unread`, `still_unread`, `read_now`, `state_unknown`)
- `detectedAt`
- `previousState`
- `currentState`
- `notificationStatus`

Incidente de disponibilidade:

- `incidentId`
- `state`
- `startedAt`
- `endedAt`
- `lastError`
- `checks`

## 8) Contrato de API interna (MVP)

Autenticacao e controle:

1. `POST /v1/auth/refresh`
2. `GET /v1/health/dte`
3. `GET /v1/incidents`

Empresas:

4. `GET /v1/companies`
5. `POST /v1/companies/{contratoId}/sync/messages`

Mensagens:

6. `GET /v1/companies/{contratoId}/messages`
7. `GET /v1/companies/{contratoId}/messages/unread`
8. `GET /v1/messages/{messageId}`

Eventos e notificacoes:

9. `GET /v1/events/unread`
10. `POST /v1/alerts/channels`
11. `GET /v1/alerts/deliveries`

Jobs:

12. `POST /v1/sync/messages`
13. `GET /v1/jobs/{jobId}`

## 9) Regras de monitoramento de disponibilidade

1. Check a cada 30-60s:
   - `GET /dte/login`
   - `POST /dte/api/v1/user/ping`
2. `DEGRADED`: 2 falhas consecutivas em qualquer check.
3. `DOWN`: 3 falhas consecutivas em ambos checks.
4. `RECOVERED`: 2 sucessos consecutivos apos `DOWN`.
5. Abrir e fechar incidente automaticamente.

## 10) Requisitos nao funcionais

1. Estabilidade:
   - retry exponencial para `502/503/504`;
   - circuit breaker por endpoint.
2. Auditabilidade:
   - salvar request/response bruto por execucao;
   - correlacao por `jobId`, `contratoId`, `messageId`.
3. Seguranca:
   - segredo do PFX fora do codigo;
   - criptografia em repouso para dados sensiveis;
   - trilha de auditoria completa.
4. Escalabilidade:
   - fila por empresa;
   - limite de concorrencia configuravel.

## 11) Backlog prioritario (proxima sprint)

1. Expandir notificacao para multiplos canais (email/WhatsApp) com mesmo outbox.
2. Implementar regras avancadas (quiet hours, cooldown por empresa e escalonamento).
3. Expor endpoint de configuracao de regras/assinaturas via API.
4. Validar tuning de retries e circuit breaker no cliente HTTP do DTE em carga real.
5. Criar dashboard operacional de fila, falhas e latencia de notificacoes.
6. Instrumentar alerta ativo quando estado DTE entrar em `DEGRADED`/`DOWN`.

## 12) Criterio de pronto para piloto

1. deteccao de nao lida com consistencia por lote de empresas alvo;
2. notificacao de novo nao lido dentro do SLA definido;
3. historico de eventos de leitura auditavel;
4. monitoramento de indisponibilidade ativo e confiavel;
5. API interna estavel para consulta de empresas, mensagens e nao lidas.

## 13) Estrategia de anexos (MinIO) - fase 7 em andamento

Diretriz:

1. nao usar Postgres para armazenar binario de PDF;
2. usar MinIO/S3 para objeto e Postgres para metadado/auditoria;
3. adotar dois modos de entrega: `proxy` e `redirect` com URL assinada.

Beneficios:

1. melhor escalabilidade para downloads;
2. reducao de dependencia do DTE em leitura recorrente;
3. trilha auditavel por hash/tamanho/chave de objeto.

Contrato da fase:

1. `POST /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/cache`
2. `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}`
3. `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download?delivery=proxy|redirect`

Documento de referencia:

- `docs/fase-07-minio-document-cache.md`

## 14) Estrategia de certificado (Vault) - fase 8 em andamento

Diretriz:

1. manter cenario single-cliente nesta etapa (um certificado ativo por vez);
2. armazenar PFX/senha criptografados no banco (sem texto puro);
3. registrar auditoria de upload/ativacao/revogacao/teste de login;
4. usar `DTE_AUTH_CERT_SOURCE=auto|db|env` para controlar origem.

Contrato de API:

1. `POST /v1/certificates/upload`
2. `GET /v1/certificates/current`
3. `POST /v1/certificates/{certificateId}/activate`
4. `POST /v1/certificates/{certificateId}/revoke`
5. `POST /v1/certificates/{certificateId}/test-login`

Documento de referencia:

- `docs/fase-08-cert-vault.md`

## 15) Estrategia de usuarios (Auth + RBAC) - fase 9 implementada (homologacao manual pendente)

Diretriz:

1. manter compatibilidade com token interno para operacao administrativa;
2. habilitar login de usuario para frontend via bearer session;
3. aplicar RBAC para reduzir risco operacional;
4. registrar auditoria de acoes de usuario.

Rotas base:

1. `POST /v1/users/login`
2. `GET /v1/users/me`
3. `POST /v1/users/logout`
4. `GET /v1/users`
5. `POST /v1/users`
6. `PATCH /v1/users/{userId}/status`
7. `POST /v1/users/{userId}/reset-password`

Documento de referencia:

- `docs/fase-09-users-auth.md`
