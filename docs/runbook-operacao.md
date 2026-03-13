# Runbook Operacao DTE API

Data base: 11 de marco de 2026.
Objetivo: procedimento padrao para operacao, contingencia e recuperacao do produto API DTE.

## 1. Pre-check diario

1. validar infraestrutura local/servidor:
   - `npm run infra:up` (quando aplicavel)
   - `npm run infra:logs`
2. validar API interna:
   - `npm run api:serve`
   - `GET /v1/health/live`
   - `GET /v1/health/dte`
3. validar monitoramento operacional:
   - `GET /v1/metrics/dte-http`
   - `GET /v1/ops/dashboard`

## 2. Rotina operacional recomendada

1. sincronizar mensagens:
   - `npm run api:dte-ingest-messages`
2. processar notificacoes:
   - `npm run api:notify-worker`
3. executar health monitor:
   - `npm run api:dte-health-worker`
4. acompanhar KPI:
   - nao lidas por empresa (`/v1/companies?onlyWithUnread=true`)
   - eventos (`/v1/events/unread`)
   - dashboard (`/v1/ops/dashboard`)

## 3. Sinais de alerta

1. `GET /v1/health/dte` com estado `DEGRADED` ou `DOWN`.
2. `GET /v1/metrics/dte-http` com crescimento de:
   - `counters.circuitOpenRejects`
   - `counters.failuresHttpStatus`
   - `counters.failuresTimeout`
3. `GET /v1/ops/dashboard` com:
   - `syncJobs.failed` crescente
   - `messages.unread` crescendo sem queda
   - `incidents.openIncidents > 0`

## 4. Contingencia por cenario

### 4.1 DTE fora (502/503/504)

1. confirmar no navegador humano.
2. validar estado:
   - `GET /v1/health/dte`
3. manter coleta em modo controlado (intervalo maior).
4. nao forcar loops agressivos; deixar circuit breaker proteger.
5. quando estabilizar, rodar sincronizacao completa:
   - `npm run api:dte-messages`
   - `npm run api:dte-ingest-messages`

### 4.2 Sessao expirada (401/redirect para login)

1. executar login manual com perfil persistente:
   - `npm run login:manual`
2. validar reuso:
   - `npm run session:reuse`
3. repetir chamada de prova:
   - `npm run api:probe`
4. se necessario, novo login via PFX:
   - `npm run api:dte-login-pfx`

### 4.3 Circuit breaker aberto em endpoint critico

1. consultar metricas:
   - `GET /v1/metrics/dte-http`
2. identificar endpoint em `circuits` com `state=open`.
3. aguardar janela `DTE_HTTP_CIRCUIT_OPEN_MS`.
4. executar nova tentativa controlada apos janela.
5. se persistir, tratar como indisponibilidade DTE (secao 4.1).

### 4.4 Falha de notificacao webhook

1. verificar filas/entregas:
   - `GET /v1/alerts/deliveries`
2. ajustar endpoint/secret do canal.
3. reprocessar worker:
   - `npm run api:notify-worker`

## 5. Recuperacao e fechamento

1. confirmar `health/dte` em `UP` ou `RECOVERED`.
2. confirmar queda de `messages.unread` apos leitura real.
3. confirmar entregas de notificacao com sucesso.
4. registrar post-mortem curto:
   - inicio/fim
   - impacto
   - causa provavel
   - acao corretiva

## 6. Gate tecnico antes de deploy/piloto

1. `npm run typecheck`
2. `npm run test:phase6`
3. smoke real:
   - login
   - sync
   - ingest
   - consulta API
   - notificacao

