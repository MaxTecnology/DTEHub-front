# Deploy de Producao - Dockploy

Objetivo: subir a API DTE em producao usando stack `docker-compose` no Dockploy com um baseline seguro e operacional.

## Arquivos de deploy

- `Dockerfile`
- `docker-compose.prod.yml`
- `.env.production.example`
- `docker/prod/entrypoint.sh`

## Baseline de producao adotado

A stack foi endurecida com os seguintes pontos:

1. imagem multi-stage com build TypeScript e runtime enxuto;
2. containers da aplicacao rodando como usuario `node` (sem root);
3. root filesystem em modo somente leitura nos servicos da aplicacao;
4. `tmpfs` dedicado para `/tmp`;
5. `cap_drop: ALL` e `no-new-privileges:true`;
6. logging com rotacao (`json-file`, `10m`, `5` arquivos);
7. migration separada em servico one-shot (`migrate`);
8. API sobe apenas depois de banco healthy e migrations concluirem com sucesso;
9. compose falha cedo se secrets/variaveis criticas nao estiverem definidos.

## Arquitetura recomendada

A stack de producao sobe 5 servicos:

1. `postgres`
   - banco da aplicacao
2. `migrate`
   - aplica migrations e encerra
3. `api`
   - sobe a API HTTP
4. `notify-worker`
   - processa notificacoes pendentes
5. `health-worker`
   - monitora indisponibilidade do DTE

Observacoes:

- Redis ficou fora porque o runtime atual nao depende dele.
- para longo prazo, a recomendacao mais profissional e usar Postgres gerenciado; nesse caso remova `postgres` da stack e ajuste `DOCKER_DATABASE_URL`.

## Variaveis obrigatorias

Preencha no Dockploy pelo menos:

- `API_INTERNAL_TOKEN`
- `CORS_ALLOWED_ORIGINS`
- `DOCKER_DATABASE_URL`
- `CERT_VAULT_MASTER_KEY_BASE64`
- `BASE_URL`
- `DTE_LOGIN_PAGE_URL`
- `NOTIFY_LINKS_BASE_URL`

Se usar o Postgres embutido da stack, preencha tambem:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Observacao importante:

- o `docker-compose.prod.yml` foi configurado para falhar no deploy se `API_INTERNAL_TOKEN`, `CORS_ALLOWED_ORIGINS`, `DOCKER_DATABASE_URL`, `CERT_VAULT_MASTER_KEY_BASE64`, `NOTIFY_LINKS_BASE_URL` e credenciais do Postgres estiverem ausentes
- isso e intencional para evitar deploy com defaults inseguros

## Passo a passo no Dockploy

1. criar um novo projeto do tipo `Compose`
2. apontar para `docker-compose.prod.yml`
3. cadastrar as variaveis baseando-se em `.env.production.example`
4. expor publicamente somente o servico `api`
5. manter `postgres`, `migrate`, `notify-worker` e `health-worker` sem exposicao externa
6. executar o deploy inicial

## Validacao apos deploy

1. validar raiz publica da API:
   - `GET /`
2. validar liveness:
   - `GET /health`
   - `GET /v1/health/live`
3. validar operacao da API:
   - `GET /v1/ops/dashboard`
3. validar auth DTE:
   - `GET /v1/auth/status`
4. cadastrar e testar certificado:
   - `POST /v1/certificates/upload`
   - `POST /v1/certificates/{certificateId}/activate`
   - `POST /v1/certificates/{certificateId}/test-login`
5. validar sync controlado:
   - `GET /v1/jobs?status=pending,running&jobType=sync_messages`
   - `POST /v1/sync/messages`
   - `GET /v1/jobs/{jobId}`

## Operacao recomendada

1. primeiro deploy:
   - subir a stack completa
   - confirmar que `migrate` terminou com sucesso
   - depois validar `api`
2. redeploy normal:
   - `migrate` executa novamente de forma idempotente
   - `api` so sobe se a migration concluir com sucesso
3. escala:
   - neste momento, escale apenas `api` se voce separar migrations e revisar exclusao mutua de jobs
   - `notify-worker` e `health-worker` devem permanecer com 1 replica inicialmente

## Volumes persistidos

- `dte_prod_postgres_data`
- `dte_prod_logs`
- `dte_prod_storage`

Uso de cada um:

- `dte_prod_postgres_data`: banco da aplicacao
- `dte_prod_logs`: artefatos JSON e historico de sync
- `dte_prod_storage`: sessao e arquivos operacionais persistidos

## Riscos e proximos passos

Este baseline ja e utilizavel em producao, mas para subir ainda mais o nivel profissional eu recomendo como proximas etapas:

1. trocar Postgres embutido por gerenciado
2. colocar reverse proxy/SSL na frente da API
3. migrar `API_INTERNAL_TOKEN` e `CERT_VAULT_MASTER_KEY_BASE64` para secrets do Dockploy
4. adicionar backup automatizado do volume do Postgres ou do banco gerenciado
5. adicionar monitoracao externa da rota `/v1/health/live`

