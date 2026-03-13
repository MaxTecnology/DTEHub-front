# Etapas de Desenvolvimento - Produto API DTE

Data base: 10 de marco de 2026.
Objetivo: plano operacional para evoluir o projeto em produto API sem deixar lacunas.

Como usar este documento:

1. executar fases em ordem;
2. marcar checklist de cada fase;
3. executar o teste da fase (`npm run test:phaseX`) antes de avancar;
4. registrar evidencias (arquivos/logs/comandos) antes de avancar.

Legenda de status:

- `pendente`
- `em_andamento`
- `concluida`
- `bloqueada`

## Gate de qualidade por fase (obrigatorio)

Regra:

1. nenhuma fase avanca para a proxima sem `test:phaseX` verde;
2. se teste falhar, fase permanece `em_andamento` ou `bloqueada`;
3. toda alteracao de fase precisa registrar evidencias no PR/log.

Comandos padrao:

- Fase 0: `npm run test:phase0`
- Fase 1: `npm run test:phase1`
- Fase 2: `npm run test:phase2`
- Fase 3: `npm run test:phase3`
- Fase 4: `npm run test:phase4`
- Fase 5: `npm run test:phase5`
- Fase 6: `npm run test:phase6`
- Fase 7: `npm run test:phase7`
- Fase 8: `npm run test:phase8`
- Fase 9: `npm run test:phase9`

Base comum dos testes:

- `typecheck`
- testes unitarios automatizados (`node:test` em `src/**/*.test.ts`)
- validacoes extras da fase (quando aplicavel)

## Visao macro

1. Fase 0 - Infra local e base de dados
2. Fase 1 - Persistencia de empresas/mensagens
3. Fase 2 - Deteccao de nao lidas e eventos
4. Fase 3 - API de consulta e sync
5. Fase 4 - Notificacoes
6. Fase 5 - Monitoramento de indisponibilidade DTE
7. Fase 6 - Endurecimento operacional e piloto
8. Fase 7 - Cache de documentos em MinIO e entrega profissional de anexos
9. Fase 8 - Vault de certificados PFX com criptografia e auditoria
10. Fase 9 - Usuarios, login bearer e RBAC da API

## Fase 0 - Infra local e base de dados

Status: `concluida`

Entregas:

- `docker-compose` com Postgres e Redis;
- schema inicial SQL versionado;
- variaveis de ambiente para conexao;
- scripts `infra:*` no `package.json`.

Checklist:

- [x] subir infraestrutura com `npm run infra:up`
- [x] validar schema inicial aplicado no Postgres
- [x] documentar conexoes locais no README
- [x] executar `npm run test:phase0`

Evidencias:

- `docker-compose.yml`
- `docker/postgres/init/001_schema.sql`
- logs de `npm run infra:logs`

## Fase 1 - Persistencia de empresas e mensagens

Status: `concluida`

Objetivo:

Persistir resultado das coletas (`dte-relevant` e `dte-messages`) no Postgres, mantendo JSON bruto e campos normalizados.

Entregas:

1. modulo de conexao com Postgres (pool + retries);
2. repositorio para `companies`, `messages`, `message_documents`;
3. script de ingestao `api:dte-ingest-messages` (ou incorporado no fluxo existente);
4. idempotencia por `contrato_id + message_id`.

Checklist:

- [x] criar camada `src/db/` (`client`, `repositories`, `mappers`)
- [x] persistir empresas com upsert
- [x] persistir mensagens com upsert
- [x] persistir documentos vinculados
- [x] salvar payload bruto para auditoria
- [x] adicionar logs com contadores (insert/update/skip)
- [x] validar 2 execucoes consecutivas com volume real de mensagens

Criterio de saida:

- consulta SQL retorna mensagens por empresa com consistencia apos 2 execucoes consecutivas.
- `npm run test:phase1` aprovado.

## Fase 2 - Deteccao de nao lidas e eventos

Status: `concluida`

Objetivo:

Transformar leitura em regra de negocio, gerando eventos de mudanca de estado.

Entregas:

1. normalizador de `readState` (`nao_lida`, `lida`, `desconhecida`);
2. detector de transicao de estado;
3. persistencia de eventos em `message_events`.

Checklist:

- [x] mapear `dataLeitura` do payload para `readState`
- [x] atualizar `unread_since` quando entrar em `nao_lida`
- [x] registrar evento `new_unread`
- [x] registrar evento `read_now`
- [x] deduplicar evento repetido na mesma janela
- [x] validar eventos com execucao real (novo nao lido e transicao para lida)

Criterio de saida:

- para um conjunto de teste conhecido, eventos gerados batem com estado esperado.
- `npm run test:phase2` aprovado.

## Fase 3 - API de consulta e sync

Status: `concluida`

Objetivo:

Expor API para consumo externo da aplicacao de negocio.

Entregas:

1. servidor HTTP (Fastify/Express) em `src/api/`;
2. endpoints MVP:
   - `GET /v1/companies`
   - `GET /v1/companies/{contratoId}/messages`
   - `GET /v1/companies/{contratoId}/messages/unread`
   - `GET /v1/events/unread`
   - `POST /v1/sync/messages`
   - `GET /v1/jobs/{jobId}`
3. validacao de input e padrao de erro.
4. guia operacional de rotas para uso manual (`docs/doc.http` e `docs/guia-rotas-api.md`).

Checklist:

- [x] definir contrato OpenAPI inicial
- [x] implementar paginacao e filtros de consulta
- [x] padronizar resposta (`data`, `meta`, `error`)
- [x] incluir autenticacao da API interna (token)

Criterio de saida:

- endpoints respondem usando dados do banco, sem depender de arquivo JSON local.
- `npm run test:phase3` aprovado.

## Fase 4 - Notificacoes de nao lidas

Status: `concluida`

Objetivo:

Notificar responsaveis quando houver novo nao lido por empresa.

Entregas:

1. cadastro de canais (webhook primeiro);
2. worker de entrega;
3. politica de retry + deduplicacao;
4. trilha de auditoria de entrega.

Checklist:

- [x] criar tabela/config de canais
- [x] enviar payload padrao de alerta
- [x] retentar falhas com backoff
- [x] impedir spam (chave de dedupe por empresa+mensagem+estado)
- [x] registrar `notification_status` em `message_events`

Criterio de saida:

- ao detectar `new_unread`, alerta entregue ao menos em webhook de teste.
- `npm run test:phase4` aprovado.

## Fase 5 - Monitoramento de indisponibilidade DTE

Status: `concluida`

Objetivo:

Detectar e comunicar quedas do DTE independentemente da aplicacao cliente.

Entregas:

1. worker de health check (`/dte/login` e `/user/ping`);
2. estado consolidado (`UP`, `DEGRADED`, `DOWN`, `RECOVERED`);
3. registro de incidentes;
4. endpoint `GET /v1/health/dte`.

Checklist:

- [x] checks periodicos com latencia e status
- [x] regras de transicao de estado implementadas
- [x] abrir/fechar incidente automaticamente
- [x] gerar evento de alerta de incidente

Criterio de saida:

- incidente e aberto e encerrado automaticamente em simulacao controlada.
- `npm run test:phase5` aprovado.

## Fase 6 - Endurecimento operacional e piloto

Status: `em_andamento`

Objetivo:

Garantir confiabilidade para uso real em producao/piloto.

Entregas:

1. retries/circuit breaker no cliente DTE;
2. testes automatizados de regressao;
3. metricas e dashboards minimos;
4. procedimento de contingencia.

Checklist:

- [ ] teste de carga leve por lote de empresas
- [x] testes de falha (502, timeout, sessao expirada)
- [x] dashboard de sincronizacao e nao lidas
- [x] runbook de operacao e recuperacao

Criterio de saida:

- execucao estavel por varios dias com monitoramento ativo e alertas funcionais.
- `npm run test:phase6` aprovado.

## Fase 7 - Cache de documentos em MinIO

Status: `em_andamento`

Objetivo:

Adicionar camada de object storage para anexos/PDF com entrega `proxy` e `redirect` (URL assinada), sem depender do DTE em toda leitura.

Entregas:

1. tabela `document_assets` para metadados de armazenamento;
2. integracao MinIO/S3 com upload + consulta;
3. rotas de cache/metadata/download de documento;
4. fallback controlado para DTE quando objeto ainda nao cacheado;
5. metrica de hit ratio do cache e trilha de auditoria.

Checklist:

- [x] definir variaveis `MINIO_*` e validar parse no config
- [x] criar migration da tabela `document_assets`
- [x] implementar servico de storage e assinatura de URL
- [x] implementar rota `POST .../cache`
- [x] implementar rota `GET .../documents/{documentoId}`
- [x] implementar download `delivery=proxy|redirect`
- [x] adicionar testes automatizados de fase (`test:phase7`)
- [ ] validar integracao com MinIO de producao (credenciais, bucket policy e retencao)

Criterio de saida:

- download de anexo funcional mesmo sem depender do DTE no momento da leitura, com fallback auditavel.
- `npm run test:phase7` aprovado.

## Fase 8 - Vault de certificados PFX

Status: `em_andamento`

Objetivo:

Adicionar gestao segura de certificado para o cenario single-cliente, com upload criptografado, ativacao/revogacao, auditoria e teste de login via API.

Entregas:

1. migration de `certificates` e `certificate_audit_logs`;
2. criptografia AES-GCM em repouso para PFX e senha;
3. rotas de certificado (`upload`, `current`, `activate`, `revoke`, `test-login`);
4. integracao do refresh de sessao para usar certificado ativo do banco (com fallback controlado);
5. teste automatizado de fase.

Checklist:

- [x] criar migration `004_certificates.sql`
- [x] criar servico de criptografia e vault
- [x] criar repositorio e auditoria de certificados
- [x] expor rotas de gestao de certificado
- [x] integrar auth refresh com certificado do banco
- [x] atualizar `.env.example`, OpenAPI e guias de rota
- [ ] validar teste real de login DTE via `/v1/certificates/{id}/test-login` com certificado de producao

Criterio de saida:

- upload seguro + ativacao + revogacao + auditoria funcionando sem expor segredo em texto puro.
- `npm run test:phase8` aprovado.

## Fase 9 - Usuarios e RBAC

Status: `em_andamento`

Objetivo:

Adicionar autenticacao de usuarios para consumo do frontend, sem quebrar o token interno existente.

Entregas:

1. schema `user_accounts`, `user_sessions`, `user_audit_logs`;
2. login bearer com sessao revogavel;
3. rotas de gestao de usuario (admin/owner);
4. guard unificado (`x-api-token` ou `Bearer`);
5. RBAC para operacoes sensiveis.

Checklist:

- [x] migration `005_users_auth.sql`
- [x] servico de hash de senha + sessao bearer
- [x] rotas `/v1/users/login`, `/v1/users/me`, `/v1/users/logout`
- [x] rotas admin `/v1/users*` com auditoria
- [x] aplicar RBAC em sync/certificados/alerts mutaveis
- [x] OpenAPI + `doc.http` + guia de rotas atualizados
- [ ] validar teste real de frontend com bearer em ambiente homolog

Criterio de saida:

- frontend consegue autenticar com usuario/senha e consumir API com bearer por role.
- `npm run test:phase9` aprovado.

## Registro de decisoes (ADR simplificado)

Sempre que houver decisao tecnica importante, registrar:

1. contexto;
2. opcoes consideradas;
3. decisao;
4. impactos;
5. data e responsavel.

Template rapido:

```text
ADR-00X - titulo
Data:
Contexto:
Opcoes:
Decisao:
Impactos:
```

## Controle de progresso (snapshot atual)

- Fase 0: `concluida`
- Fase 1: `concluida`
- Fase 2: `concluida`
- Fase 3: `concluida`
- Fase 4: `concluida`
- Fase 5: `concluida`
- Fase 6: `em_andamento`
- Fase 7: `em_andamento`
- Fase 8: `em_andamento`
- Fase 9: `em_andamento`
