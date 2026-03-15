# Fluxo da Aplicacao (Mermaid)

Data base: 12 de marco de 2026.
Escopo: estado atual da API DTE (single-cliente), com vault de certificado, sync, ingestao, eventos e notificacoes.

## 1) Visao geral da arquitetura

```mermaid
flowchart LR
    U[Operador / Frontend] -->|HTTP + x-api-token| API[DTE Internal API]
    API --> DB[(Postgres)]
    API --> REDIS[(Redis)]
    API --> DTE[DTE SEFAZ]

    DB --> API
    DTE --> API

    W1[Worker Sync]
    W2[Worker Notificacao]
    W3[Worker Health DTE]

    W1 --> API
    W2 --> API
    W3 --> API
```

## 2) Fluxo de certificado (upload + teste de login)

```mermaid
sequenceDiagram
    autonumber
    participant OP as Operador
    participant API as API /v1/certificates/*
    participant CV as CertificateVaultService
    participant CR as CertificateRepository
    participant DTEA as DteAuthSessionService
    participant DTE as DTE
    participant DB as Postgres

    OP->>API: POST /v1/certificates/upload (multipart: file + password + label)
    API->>CV: parse PFX + encrypt (AES-256-GCM)
    CV->>CR: createEncrypted(...)
    CR->>DB: INSERT certificates + audit_log
    DB-->>CR: ok
    CR-->>API: certificate metadata
    API-->>OP: 201 Created

    OP->>API: POST /v1/certificates/{id}/test-login
    API->>DTEA: refreshSessionWithCertificateId(id)
    DTEA->>CR: load encrypted cert
    CR->>DB: SELECT cert ativo/id
    DB-->>CR: encrypted cert
    DTEA->>DTE: login + ping + contratos + contratoAtivo + ping
    DTE-->>DTEA: authenticated=true
    DTEA->>CR: update last_tested_at + audit
    CR->>DB: UPDATE certificates + INSERT audit_log
    API-->>OP: 200 OK (auth.refreshed=true)
```

## 3) Fluxo de sincronizacao de mensagens

```mermaid
sequenceDiagram
    autonumber
    participant OP as Operador
    participant API as POST /v1/sync/messages
    participant JOB as DteSyncJobService
    participant AUTH as DteAuthSessionService
    participant MSG as DteMessagesService
    participant ING as DteMessageIngestionService
    participant DTE as DTE
    participant DB as Postgres

    OP->>API: POST /v1/sync/messages
    API->>JOB: startSyncMessagesJob()
    JOB->>DB: INSERT sync_jobs(status=pending)
    API-->>OP: 202 Accepted (jobId)

    JOB->>DB: UPDATE sync_jobs(status=running)
    JOB->>AUTH: ensureAuthenticated(autoRefresh)
    AUTH->>DTE: ping/login(certificado)/ping final
    DTE-->>AUTH: session ok

    JOB->>MSG: extractMessagesByCompany()
    loop cada empresa selecionada
        MSG->>DTE: PUT contratoHonorarioAtivo
        DTE-->>MSG: 200
        loop paginacao Exped
            MSG->>DTE: POST /dte/api/process/Exped
            DTE-->>MSG: response.beans
        end
    end
    MSG-->>JOB: arquivo latest dte-exped-messages.json

    JOB->>ING: ingestFromLatestReport()
    ING->>DB: UPSERT companies
    ING->>DB: UPSERT messages (contrato_id + message_id)
    ING->>DB: REPLACE message_documents por mensagem
    ING->>DB: INSERT message_events (com dedupe)

    JOB->>DB: UPDATE sync_jobs(status=success|failed, result_summary)
```

## 4) Regra de persistencia no sync (sem duplicar mensagens)

```mermaid
flowchart TD
    A[Mensagem recebida no lote] --> B{Existe por contrato_id + message_id?}
    B -- Nao --> C[INSERT messages]
    B -- Sim --> D[UPDATE messages]
    C --> E[DELETE docs antigos da mensagem]
    D --> E[DELETE docs antigos da mensagem]
    E --> F[INSERT docs atuais]
    F --> G{Mudou estado de leitura?}
    G -- Sim --> H[INSERT message_event com dedupe]
    G -- Nao --> I[Sem novo evento]
```

## 5) Fluxo de leitura de mensagem e anexo para frontend

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant API as API
    participant DB as Postgres
    participant DTE as DTE

    FE->>API: GET /v1/companies/{contratoId}/messages/unread
    API->>DB: SELECT mensagens persistidas
    DB-->>API: lista
    API-->>FE: data[]

    FE->>API: GET /v1/companies/{c}/messages/{m}/view
    API->>DB: SELECT mensagem + documentos
    API-->>FE: conteudo sem marcar leitura no portal

    FE->>API: GET /documents/{d}/download?delivery=proxy
    API->>DTE: download autenticado
    DTE-->>API: arquivo
    API-->>FE: PDF
```

## 6) Fluxo de notificacao de nao lidas

```mermaid
flowchart LR
    A[message_events new_unread/still_unread/read_now] --> B[notification planner]
    B --> C[notification_outbox]
    C --> D[notification worker]
    D --> E[Webhook destino]
    D --> F[notification_deliveries (auditoria)]
    D --> G{falhou?}
    G -- sim --> H[retry/backoff]
    H --> D
    G -- nao --> I[status sent]
```

## 7) Fluxo de health do DTE

```mermaid
stateDiagram-v2
    [*] --> UP
    UP --> DEGRADED: falhas consecutivas >= limiar endpoint
    DEGRADED --> DOWN: falhas consecutivas ambos endpoints >= limiar
    DOWN --> RECOVERED: sucessos consecutivos >= limiar
    RECOVERED --> UP: estabilizado
    DEGRADED --> UP: recuperou antes de DOWN
```

## 8) Fluxo de usuarios (login bearer + RBAC)

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant API as API /v1/users/*
    participant UAS as UserAuthService
    participant DB as Postgres

    FE->>API: POST /v1/users/login (email, password)
    API->>UAS: login()
    UAS->>DB: SELECT user_accounts + validate hash/salt
    DB-->>UAS: usuario ativo
    UAS->>DB: INSERT user_sessions(token_hash, expires_at)
    UAS->>DB: INSERT user_audit_logs(action=user_login_success)
    UAS-->>API: accessToken Bearer
    API-->>FE: 200 {accessToken, expiresAt, user}

    FE->>API: GET /v1/users/me (Authorization: Bearer)
    API->>UAS: authenticateAccessToken()
    UAS->>DB: SELECT user_sessions ativo
    DB-->>UAS: principal(role)
    API-->>FE: 200 user + role

    FE->>API: POST /v1/sync/messages (Bearer)
    API->>API: assertRole(operator|admin|owner)
    API-->>FE: 202 accepted | 403 forbidden
```

## 9) Endpoints chave por etapa

1. Certificado:
   - `POST /v1/certificates/upload`
   - `POST /v1/certificates/{certificateId}/test-login`
   - `GET /v1/certificates/current`
2. Sessao/auth:
   - `GET /v1/auth/status`
   - `POST /v1/auth/refresh`
3. Sync e consulta:
   - `GET /v1/jobs?status=pending,running&jobType=sync_messages`
   - `POST /v1/sync/messages`
   - `GET /v1/jobs`
   - `GET /v1/jobs/{jobId}`
   - `GET /v1/companies`
   - `GET /v1/companies/{contratoId}/messages/unread`
4. Documento/anexo:
   - `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}`
   - `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download`
5. Usuarios/RBAC:
   - `POST /v1/users/login`
   - `GET /v1/users/me`
   - `POST /v1/users/logout`
   - `GET /v1/users`
   - `POST /v1/users`
   - `PATCH /v1/users/{userId}/status`
   - `POST /v1/users/{userId}/reset-password`

