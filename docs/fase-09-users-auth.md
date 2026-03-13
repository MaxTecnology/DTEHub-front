# Fase 9 - Usuarios, Login Bearer e RBAC

Status: `em_andamento` (implementacao e testes automatizados concluidos; pendente homologacao manual no frontend)
Data base: 12 de marco de 2026.

## Objetivo

Permitir autenticacao de usuarios para consumo da API no frontend, mantendo compatibilidade com `API_INTERNAL_TOKEN`.

## Escopo implementado

1. banco:
   - `user_accounts`
   - `user_sessions`
   - `user_audit_logs`
2. login bearer:
   - senha com `scrypt` + salt
   - token de sessao aleatorio + hash SHA-256 no banco
3. guard unificado:
   - aceita `x-api-token` (modo interno)
   - aceita `Authorization: Bearer <token>` (sessao de usuario)
4. RBAC:
   - roles: `owner`, `admin`, `operator`, `viewer`
   - operacoes sensiveis protegidas por role

## Rotas principais

Publica:

1. `POST /v1/users/login`

Protegidas:

1. `GET /v1/users/me`
2. `POST /v1/users/logout`

Admin/Owner:

1. `GET /v1/users`
2. `POST /v1/users`
3. `PATCH /v1/users/{userId}/status`
4. `POST /v1/users/{userId}/reset-password`
5. `GET /v1/users/audit`

## Regras RBAC aplicadas

1. `sync/messages` e `auth/refresh`: `operator | admin | owner`
2. certificados: `admin | owner`
3. alertas (mutacao): `admin | owner`
4. operacoes de usuarios: `admin | owner`

## Observacoes de seguranca

1. senha nunca e armazenada em texto puro;
2. token de sessao nunca e armazenado em texto puro (somente hash);
3. logout revoga sessao atual;
4. reset de senha revoga sessoes existentes do usuario alvo.

## Teste da fase

Comando:

1. `npm run test:phase9`

Cobertura do smoke:

1. criar usuarios (operator/viewer) via token interno;
2. login bearer;
3. acessar `/v1/users/me`;
4. validar permissao de `operator` em sync dry-run;
5. validar `viewer` bloqueado em sync (`403`);
6. logout e rejeicao da sessao revogada.

## Evidencia de execucao

1. `npm run test:phase9`:
   - typecheck: aprovado;
   - testes unitarios: aprovados;
   - migracoes SQL aplicadas ate `005_users_auth.sql`;
   - smoke da fase 9: aprovado (`Phase 9 users/auth smoke test passed`).
