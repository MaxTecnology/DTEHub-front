# Fase 8 - Vault de Certificados PFX (single-cliente)

Status: `em_andamento`
Data base: 12 de marco de 2026.

## Objetivo

Armazenar certificado PFX e senha de forma segura no banco para uso pelo backend, sem depender exclusivamente de arquivo local em disco.

## Escopo desta fase

1. cenario single-cliente (um certificado ativo por vez);
2. criptografia em repouso para PFX/senha;
3. auditoria de operacoes com certificado;
4. integracao com refresh de sessao DTE;
5. rotas API para operacao.

## Itens implementados

1. Migration:
   - `docker/postgres/init/004_certificates.sql`
   - tabelas: `certificates`, `certificate_audit_logs`
2. Cofre criptografado:
   - `src/services/certificate-crypto-service.ts`
   - algoritmo: `aes-256-gcm`
   - chave mestre via env: `CERT_VAULT_MASTER_KEY_BASE64`
3. Gestao:
   - `src/services/certificate-management-service.ts`
   - `src/services/certificate-vault-service.ts`
   - `src/db/repositories/certificate-repository.ts`
4. Integracao auth:
   - `src/services/dte-auth-session-service.ts`
   - suporte a `DTE_AUTH_CERT_SOURCE=auto|env|db`
5. Rotas:
   - `GET /v1/certificates`
   - `GET /v1/certificates/current`
   - `GET /v1/certificates/audit`
   - `POST /v1/certificates/upload`
   - `POST /v1/certificates/{certificateId}/activate`
   - `POST /v1/certificates/{certificateId}/revoke`
   - `POST /v1/certificates/{certificateId}/test-login`
6. Teste:
   - `src/scripts/test-phase8-certificates.ts`
   - comando: `npm run test:phase8`
7. Upload:
   - modo recomendado: `multipart/form-data` com arquivo `.pfx` + `password`
   - fallback: JSON com `pfxBase64` em linha unica

## Contrato de seguranca

1. segredo nunca e retornado por API;
2. PFX e senha nunca ficam em texto puro no banco;
3. trilha de auditoria para upload/ativacao/revogacao/teste;
4. troca de certificado por ativacao explicita;
5. recomendacao de rotacao periodica da chave mestre.

## Variaveis obrigatorias para vault

1. `DTE_AUTH_CERT_SOURCE=auto|db|env`
2. `CERT_VAULT_MASTER_KEY_BASE64` (base64 de 32 bytes)
3. `CERT_VAULT_KEY_VERSION` (ex.: `v1`)
4. `CERT_UPLOAD_MAX_BYTES` (limite de upload)

## Fluxo operacional recomendado

1. subir API;
2. `POST /v1/certificates/upload` com `activate=true`;
3. `POST /v1/certificates/{id}/test-login`;
4. `GET /v1/auth/status` para confirmar sessao autenticada;
5. executar sync por `POST /v1/sync/messages`.

## Pendencias para concluir fase

1. teste real com certificado de producao no endpoint `test-login`;
2. validar runbook de rotacao de chave mestre;
3. definir politica de acesso por usuario (fase de identidade/frontend).
