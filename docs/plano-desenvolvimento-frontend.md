# Plano de Desenvolvimento - DTE Console Frontend

Data base: 12 de marco de 2026.
Stack atual: React 19 + Vite + TanStack Query + react-router-dom v7 + shadcn/ui + Axios + Tailwind v4 + Zod + React Hook Form.

---

## Estado atual do projeto

- `App.jsx`: template padrao do Vite (sem implementacao real)
- `src/components/ui/button.jsx`: unico componente shadcn inicializado
- Sem rotas, sem auth, sem camada de servicos

---

## Fase 1 — Fundacao (infraestrutura de projeto)

**Objetivo**: preparar a base para todas as fases seguintes. Sem esta fase nada funciona.

### 1.1 Estrutura de diretorios

Criar a seguinte arvore em `src/`:

```
src/
  api/           # cliente axios + interceptors + tipos de erro
  hooks/         # hooks de auth, query hooks por dominio
  modules/
    auth/        # login, logout, guard de rota
    dashboard/   # cards de saude + resumo
    companies/   # listagem de empresas
    messages/    # listagem + detalhe de mensagem
    documents/   # preview + download
    jobs/        # acompanhamento de sync
    alerts/      # canais e entregas (operator+)
    admin/
      users/     # crud de usuarios
      certificates/ # upload + ativar + revogar
  store/         # sessao e preferencias globais (Context ou Zustand)
  components/    # componentes compartilhados (layout, tabela, badge, etc)
    ui/          # shadcn components
  lib/           # utilitarios (cn, formatters, constantes)
  router/        # definicao de rotas e guards
```

### 1.2 Cliente HTTP (`src/api/client.js`)

- instancia axios com `baseURL` vinda de `VITE_API_BASE_URL`
- interceptor de request: injeta `Authorization: Bearer <token>` quando sessao ativa
- interceptor de response:
  - `401` → limpar sessao e redirecionar para `/login`
  - `403` → propagar erro com flag `forbidden: true`
  - `502/503/504` → propagar com flag `dteDown: true`

### 1.3 Variaveis de ambiente

Criar `.env.local` (nao commitar):

```
VITE_API_BASE_URL=http://localhost:3000
```

Criar `.env.example` (commitar):

```
VITE_API_BASE_URL=http://localhost:3000
```

### 1.4 Sessao global (`src/store/session.jsx`)

- `SessionProvider` (Context)
- estado: `{ token, user, role, isAuthenticated }`
- acoes: `login(token, user)`, `logout()`
- persistencia: `sessionStorage` (token some ao fechar aba)

### 1.5 React Query e Router

Configurar em `src/main.jsx`:
- `QueryClientProvider` com defaults:
  - `staleTime: 30_000`
  - `retry: 1`
  - `refetchOnWindowFocus: false`
- `BrowserRouter` envolvendo tudo

### 1.6 shadcn/ui — componentes minimos

Inicializar via CLI os componentes necessarios para as fases:
- `button`, `input`, `label`, `form`, `card`, `badge`, `table`, `dialog`, `toast`, `skeleton`, `alert`, `separator`, `dropdown-menu`, `avatar`

### Entregavel da Fase 1

- [ ] estrutura de pastas criada
- [ ] cliente axios com interceptors funcionando
- [ ] `SessionProvider` com persistencia em sessionStorage
- [ ] `.env.example` commitado
- [ ] React Query configurado com defaults
- [ ] Router basico configurado (sem rotas reais ainda)
- [ ] shadcn inicializado com componentes base

---

## Fase 2 — Autenticacao e guards de rota

**Objetivo**: login funcional com bearer, guard por autenticacao e por role.

**Endpoints usados**:
- `POST /v1/users/login`
- `GET /v1/users/me`
- `POST /v1/users/logout`

### 2.1 Servico de auth (`src/api/auth.js`)

```js
// POST /v1/users/login
login(email, password) → { accessToken, expiresAt, user }

// GET /v1/users/me
getMe() → { id, email, role, status }

// POST /v1/users/logout
logout() → void
```

### 2.2 Tela de Login (`src/modules/auth/LoginPage.jsx`)

- formulario: email + senha com validacao Zod
- ao submeter: chama `login()`, salva token na sessao, redireciona para `/dashboard`
- erros de credencial: exibe mensagem inline (nao toast)
- se sessao ativa ao acessar `/login`: redirecionar para `/dashboard`

### 2.3 Guards de rota (`src/router/guards.jsx`)

Dois componentes:

1. `RequireAuth` — redireciona para `/login` se `!isAuthenticated`
2. `RequireRole` — recebe prop `roles: string[]`, exibe tela de "acesso negado" se role insuficiente

### 2.4 Definicao de rotas (`src/router/index.jsx`)

```
/login                     → LoginPage (publica)
/dashboard                 → DashboardPage (RequireAuth)
/companies                 → CompaniesPage (RequireAuth)
/companies/:id/messages    → MessagesPage (RequireAuth)
/companies/:id/messages/:msgId → MessageDetailPage (RequireAuth)
/jobs                      → JobsPage (RequireAuth, operator+)
/alerts                    → AlertsPage (RequireAuth, operator+)
/admin/users               → AdminUsersPage (RequireAuth, admin+)
/admin/certificates        → AdminCertsPage (RequireAuth, admin+)
/                          → redirect para /dashboard
```

### 2.5 Layout base (`src/components/layout/`)

- `AppLayout.jsx`: sidebar + header com nome do usuario logado + botao de logout
- sidebar: links visisiveis por role
- `AuthLayout.jsx`: layout simples para pagina de login

### 2.6 Hook `useAuth`

```js
const { user, role, isAuthenticated, login, logout } = useAuth()
```

### Entregavel da Fase 2

- [ ] `POST /v1/users/login` funcionando e salvando token
- [ ] `GET /v1/users/me` chamado no boot da app para validar sessao
- [ ] logout chama `POST /v1/users/logout` e limpa sessao
- [ ] `401` em qualquer rota redireciona para login
- [ ] `RequireAuth` e `RequireRole` funcionando
- [ ] sidebar exibe links corretos por role
- [ ] layout base aplicado em todas as rotas protegidas

---

## Fase 3 — Dashboard operacional

**Objetivo**: tela principal com visao rapida de saude e resumo.

**Endpoints usados**:
- `GET /v1/health/dte`
- `GET /v1/ops/dashboard`

### 3.1 Servico (`src/api/ops.js`)

```js
getHealthDte() → { status: 'UP'|'DEGRADED'|'DOWN', ... }
getDashboard() → { totalCompanies, totalUnread, lastSync, ... }
```

### 3.2 Cards do dashboard

1. **Status DTE** — badge colorido: verde (UP), amarelo (DEGRADED), vermelho (DOWN)
2. **Total de empresas** — numero com link para `/companies`
3. **Nao lidas** — numero total de mensagens nao lidas com link para `/companies?onlyWithUnread=true`
4. **Ultimo sync** — timestamp formatado do ultimo job completado

### 3.3 Banner de instabilidade

- quando DTE for `DEGRADED` ou `DOWN`: exibir banner fixo no topo do layout
- mensagem clara com botao para ver detalhes de health

### 3.4 Atalho de sync no dashboard

- botao "Sincronizar agora" disponivel para `operator+`
- ao clicar: chama `POST /v1/sync/messages` e redireciona para `/jobs` com o `jobId`
- usar o fluxo de polling da Fase 5

### 3.5 Polling e stale time

- `GET /v1/health/dte`: refetch a cada 30s
- `GET /v1/ops/dashboard`: refetch a cada 60s
- pausar polling quando aba estiver inativa (`refetchIntervalInBackground: false`)

### Entregavel da Fase 3

- [ ] cards renderizando dados reais da API
- [ ] badge de status DTE com cor correta
- [ ] banner aparece quando DTE nao esta UP
- [ ] polling ativo com intervalos corretos
- [ ] botao de sync visivel apenas para operator+

---

## Fase 4 — Empresas e mensagens

**Objetivo**: listagem de empresas e mensagens por empresa, com filtros e destaque de nao lidas.

**Endpoints usados**:
- `GET /v1/companies`
- `GET /v1/companies?onlyWithUnread=true`
- `GET /v1/companies/{contratoId}/messages`
- `GET /v1/companies/{contratoId}/messages/unread`

### 4.1 Servico (`src/api/companies.js`)

```js
getCompanies(params) → { data: Company[] }
getMessages(contratoId, params) → { data: Message[] }
getUnreadMessages(contratoId) → { data: Message[] }
```

### 4.2 Pagina de Empresas

- tabela com colunas: nome da empresa, `contratoId`, quantidade de nao lidas, acoes
- filtro "Somente com nao lidas" (toggle) → usa `?onlyWithUnread=true`
- badge de quantidade nao lida por linha
- ao clicar: navega para `/companies/:contratoId/messages`

### 4.3 Pagina de Mensagens por Empresa

- titulo com nome da empresa
- tabela: assunto, data, status de leitura (`nao_lida`/`lida`/`desconhecida`), documentos
- filtro por `readState` e por periodo
- linhas com `readState=nao_lida` com destaque visual forte (fundo ou borda colorida)
- ao clicar na linha: navega para `/companies/:contratoId/messages/:messageId`
- botao "Ver apenas nao lidas" para filtrar usando `/messages/unread`

### 4.4 Componentes compartilhados

- `ReadStateBadge` — badge colorida para `nao_lida`, `lida`, `desconhecida`
- `UnreadCount` — numero com destaque
- `DataTable` — tabela generica com suporte a filtros e paginacao

### Entregavel da Fase 4

- [ ] lista de empresas com filtro onlyWithUnread funcionando
- [ ] badge de quantidade nao lida por empresa
- [ ] lista de mensagens com destaque visual para nao lidas
- [ ] filtros por readState e periodo funcionando
- [ ] navegacao entre empresa → mensagens → detalhe funcionando

---

## Fase 5 — Detalhe da mensagem e documentos

**Objetivo**: visualizar mensagem e baixar/visualizar documentos sem marcar leitura no portal.

**Endpoints usados**:
- `GET /v1/companies/{contratoId}/messages/{messageId}`
- `GET /v1/companies/{contratoId}/messages/{messageId}/view`
- `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}`
- `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download?delivery=proxy`
- `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download?delivery=redirect`
- `POST /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/cache`

### 5.1 Servico (`src/api/messages.js`)

```js
getMessage(contratoId, messageId) → Message
getMessageView(contratoId, messageId) → { html|text conteudo }
getDocument(contratoId, messageId, documentoId) → DocumentMeta
downloadDocument(contratoId, messageId, documentoId, delivery) → blob|redirect
cacheDocument(contratoId, messageId, documentoId) → void
```

### 5.2 Pagina de detalhe da mensagem

- metadados: remetente, data, assunto, readState
- conteudo via `/view` renderizado em iframe ou area de texto segura
- lista de documentos com:
  - nome do arquivo
  - indicador de origem: `storage` (cacheado no MinIO) ou `DTE` (busca ao vivo)
  - botao "Download" e botao "Preview" (quando aplicavel)
  - botao "Cachear" para `operator+`

### 5.3 Download de documento

- `delivery=proxy`: API retorna bytes, front faz download via blob URL
- `delivery=redirect`: API redireciona para URL presigned do MinIO
- tratar `401` no download: exibir mensagem de sessao DTE expirada

### 5.4 Tratamento de erros especificos

- `409`: sessao DTE indisponivel para buscar documento — mostrar botao "Tentar novamente"
- `502/503/504`: instabilidade DTE — exibir banner e manter dados do banco visiveis

### Entregavel da Fase 5

- [ ] detalhe da mensagem carregando via `/view`
- [ ] lista de documentos com indicador de origem
- [ ] download via proxy funcionando (blob download no browser)
- [ ] download via redirect funcionando
- [ ] cache de documento chamando endpoint correto
- [ ] erros 401/409/5xx tratados com feedback claro

---

## Fase 6 — Jobs de sync

**Objetivo**: disparar sync e acompanhar em tempo real via polling.

**Endpoints usados**:
- `POST /v1/sync/messages`
- `GET /v1/jobs/{jobId}`

### 6.1 Servico (`src/api/jobs.js`)

```js
startSync(params) → { jobId }
getJob(jobId) → { status, progress, errorMessage, resultSummary }
```

### 6.2 Hook `useSyncJob`

- inicia job com `POST /v1/sync/messages`
- polling `GET /v1/jobs/{jobId}` a cada 2-3 segundos
- para o polling quando status for `completed` ou `failed`
- retorna `{ status, progress, errorMessage, isRunning }`

### 6.3 Pagina de Jobs

- lista de jobs recentes (se a API expuser lista)
- cada job exibe: status com icone, timestamp, `resultSummary`
- job `failed`: exibir `errorMessage` com destaque e sugestao de acao
- job `running`: barra de progresso textual
- botao "Novo sync" para `operator+`

### 6.4 Fluxo de sync a partir do Dashboard

1. usuario clica "Sincronizar agora"
2. modal de confirmacao (opcional: `dryRun`)
3. chama `POST /v1/sync/messages`, recebe `jobId`
4. exibe progresso inline no dashboard
5. ao `completed`: recarrega dados de empresas/mensagens
6. ao `failed`: exibe erro com link para `/jobs`

### Entregavel da Fase 6

- [ ] POST sync retornando jobId
- [ ] polling com parada automatica em completed/failed
- [ ] pagina de jobs listando e atualizando status
- [ ] feedback visual de progresso (pending/running/completed/failed)
- [ ] invalidacao de cache do TanStack Query ao completar sync

---

## Fase 7 — Alertas

**Objetivo**: listar e gerenciar canais e entregas de notificacao.

**Endpoints usados**:
- `GET /v1/alerts/channels`
- `POST /v1/alerts/channels` (admin/owner)
- `GET /v1/alerts/deliveries`

**Acesso**: `operator+` para leitura, `admin/owner` para mutacao.

### 7.1 Pagina de Alertas

- lista de canais configurados (webhook, etc)
- status de cada canal (ativo/inativo)
- botao "Adicionar canal" visivel apenas para `admin/owner`
- lista de entregas recentes com status (`sent`/`failed`/`retrying`)

### 7.2 Formulario de canal (admin/owner)

- tipo: webhook
- URL de destino
- eventos que disparam (nao lidas, etc)
- validacao com Zod antes de submeter

### Entregavel da Fase 7

- [ ] lista de canais renderizando
- [ ] lista de entregas com status
- [ ] formulario de criacao funcionando para admin/owner
- [ ] acoes de mutacao invisiveis para operator/viewer

---

## Fase 8 — Admin: Usuarios

**Objetivo**: gerenciar usuarios do sistema.

**Endpoints usados**:
- `GET /v1/users`
- `POST /v1/users`
- `PATCH /v1/users/{userId}/status`
- `POST /v1/users/{userId}/reset-password`
- `GET /v1/users/audit`

**Acesso**: `admin/owner` apenas.

### 8.1 Pagina de Usuarios

- tabela: email, role, status (ativo/inativo), data de criacao
- acoes por linha: ativar/desativar, reset de senha
- botao "Criar usuario"

### 8.2 Formulario de criacao de usuario

- campos: email, senha temporaria, role
- validacao: email valido, senha minima, role obrigatoria

### 8.3 Trilha de auditoria

- tabela separada com log de acoes: login, logout, criacao, reset, etc
- filtro por usuario e por tipo de acao

### Entregavel da Fase 8

- [ ] lista de usuarios com status
- [ ] ativar/desativar usuario
- [ ] reset de senha (modal de confirmacao)
- [ ] criacao de usuario funcionando
- [ ] trilha de auditoria visivel

---

## Fase 9 — Admin: Certificados

**Objetivo**: gerenciar o vault de certificados PFX para autenticacao DTE.

**Endpoints usados**:
- `GET /v1/certificates`
- `GET /v1/certificates/current`
- `POST /v1/certificates/upload`
- `POST /v1/certificates/{certificateId}/activate`
- `POST /v1/certificates/{certificateId}/revoke`
- `POST /v1/certificates/{certificateId}/test-login`

**Acesso**: `admin/owner` apenas.

### 9.1 Pagina de Certificados

- certificado ativo em destaque (card no topo)
- lista de todos os certificados: label, status, validade, `last_tested_at`
- acoes: ativar, revogar, testar login

### 9.2 Upload de certificado (formulario)

- campo de arquivo `.pfx` (file input)
- campo de senha do certificado (input password)
- campo de label descritivo
- ao submeter: `multipart/form-data` para `POST /v1/certificates/upload`
- tratar `400` (senha errada, arquivo invalido) com mensagem clara

### 9.3 Teste de login

- botao "Testar login" por certificado
- exibe resultado passo a passo (ping, login, contratos, contratoAtivo, ping final)
- `auth.refreshed=true` → sucesso verde
- falha → exibe mensagem de erro da API

### Entregavel da Fase 9

- [ ] lista de certificados com status correto
- [ ] upload de PFX funcionando
- [ ] ativar/revogar certificado
- [ ] teste de login com feedback de passos

---

## Fase 10 — Hardening, UX e QA

**Objetivo**: polimento final, tratamento de erros robusto e qualidade de entrega.

### 10.1 Tratamento global de erros

- `401`: redirect para login com mensagem "Sessao expirada"
- `403`: tela/componente de "Acesso negado" com role atual e role necessaria
- `409`: mensagem de negocio especifica por contexto (sync, download)
- `502/503/504`: banner global de instabilidade DTE

### 10.2 Estados de loading e skeleton

- todas as tabelas com skeleton enquanto carregam
- botoes com estado de loading durante mutacoes
- evitar layout shift

### 10.3 Feedback de operacoes

- toast de sucesso para: sync disparado, documento cacheado, usuario criado, certificado ativado
- toast de erro para: falhas de rede, validacoes do servidor

### 10.4 Acessibilidade minima

- labels em todos os campos de formulario
- mensagens de erro associadas ao campo (aria-describedby)
- foco gerenciado ao abrir modais

### 10.5 Checklist de smoke test (validar com `docs/doc.http`)

1. login com bearer funcionando
2. dashboard carregando com dados reais
3. lista de empresas com filtro onlyWithUnread
4. mensagem nao lida com destaque visual
5. download de documento em modo proxy e redirect
6. sync com polling ate completed
7. usuario viewer nao consegue executar mutacoes
8. banner aparece quando DTE esta DEGRADED/DOWN

### Entregavel da Fase 10

- [ ] todos os fluxos de erro tratados
- [ ] skeletons em todas as listas
- [ ] toasts de feedback implementados
- [ ] smoke test manual completo aprovado
- [ ] `.env.example` atualizado

---

## Resumo das fases

| Fase | Descricao                         | Dependencias |
|------|-----------------------------------|--------------|
| 1    | Fundacao (infra, cliente, sessao) | —            |
| 2    | Auth + guards de rota             | Fase 1       |
| 3    | Dashboard operacional             | Fase 2       |
| 4    | Empresas e mensagens              | Fase 2       |
| 5    | Detalhe e documentos              | Fase 4       |
| 6    | Jobs de sync                      | Fase 3, 4    |
| 7    | Alertas                           | Fase 2       |
| 8    | Admin usuarios                    | Fase 2       |
| 9    | Admin certificados                | Fase 2       |
| 10   | Hardening e QA                    | Todas        |

---

## Convencoes de codigo

1. arquivos `.jsx` para componentes, `.js` para servicos e utilitarios
2. hooks customizados em `src/hooks/` com prefixo `use`
3. servicos de API em `src/api/` com uma funcao por endpoint
4. validacao de formulario sempre com Zod + React Hook Form
5. queries TanStack com `queryKey` canonico por recurso: `['companies']`, `['messages', contratoId]`, `['job', jobId]`
6. mutacoes TanStack com `invalidateQueries` ao sucesso para manter dados frescos
7. nunca armazenar token em `localStorage` — usar apenas `sessionStorage`
8. nunca enviar `x-api-token` no frontend — apenas `Authorization: Bearer`

---

## Referencias

- [frontend-handoff.md](./frontend-handoff.md) — contrato completo de integracao
- [frontend-proposta.md](./frontend-proposta.md) — decisoes de UX e arquitetura
- [guia-rotas-api.md](./guia-rotas-api.md) — ordem de chamadas e troubleshooting
- [fluxo-aplicacao.md](./fluxo-aplicacao.md) — diagramas de sequencia dos fluxos
- [fase-09-users-auth.md](./fase-09-users-auth.md) — detalhes de auth e RBAC
- [openapi-v1-inicial.json](./openapi-v1-inicial.json) — spec OpenAPI completa
- [doc.http](./doc.http) — arquivo de testes manuais das rotas
