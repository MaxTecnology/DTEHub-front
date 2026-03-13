# Fase 7 - Cache de Documentos com MinIO

Data base: 12 de marco de 2026.
Status: `em_andamento`.
Objetivo: tornar o download de anexos robusto e escalavel, reduzindo dependencia de disponibilidade do DTE no momento da leitura.

## 0. Base ja implementada

1. variaveis `OBJECT_STORAGE_*` e `MINIO_*` no config;
2. migration `document_assets`;
3. servico MinIO para upload/download/presigned URL;
4. rotas:
   - `GET /.../documents/{documentoId}`
   - `POST /.../documents/{documentoId}/cache`
   - `GET /.../documents/{documentoId}/download?delivery=proxy|redirect`

## 1. Decisao de arquitetura

Decisao:

1. manter Postgres para metadados e auditoria;
2. armazenar binarios (PDF/anexos) em object storage (MinIO/S3);
3. API continua como camada de autorizacao e observabilidade.

Racional:

1. banco relacional nao e ideal para blobs grandes;
2. object storage simplifica escalabilidade e custo;
3. URL assinada reduz carga da API para downloads de alto volume.

## 2. Modos de entrega de arquivo

1. `proxy`
   - API le do MinIO e streama para o cliente.
   - melhor para integracoes que exigem controle central no backend.
2. `redirect`
   - API gera URL assinada curta e retorna `302`.
   - melhor para front web, menor custo de CPU/rede na API.

## 3. Estados de armazenamento de documento

Padrao sugerido:

1. `pending`: cache ainda nao iniciado ou em fila.
2. `stored`: objeto persistido no MinIO e pronto para entrega.
3. `failed`: tentativa de cache falhou.
4. `stale`: objeto existe, mas precisa revalidacao (opcional).

## 4. Contrato de rotas (alvo profissional)

Observacao: base dessas rotas ja esta implementada. Itens de evolucao (jobs assincronos, politicas avancadas e observabilidade ampliada) seguem como backlog.

1. `POST /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/cache`
   - inicia cache imediato (ou enfileira).
   - retorno esperado: `202` com `jobId`.
2. `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}`
   - retorna metadados + `storageStatus`.
   - retorno esperado: `200` ou `404`.
3. `GET /v1/companies/{contratoId}/messages/{messageId}/documents/{documentoId}/download?delivery=proxy|redirect`
   - `proxy`: `200` com binario.
   - `redirect`: `302` para URL assinada.
   - se nao estiver cacheado e `autoFetch=true`, retorna `202` com job.
4. `GET /v1/jobs/{jobId}`
   - reuso do endpoint atual para status de cache.

## 5. Modelo de dados alvo

Tabela sugerida: `document_assets`

Campos sugeridos:

1. `id` (uuid)
2. `contrato_id` (bigint)
3. `message_id` (bigint)
4. `documento_id` (bigint)
5. `storage_status` (`pending|stored|failed|stale`)
6. `bucket` (text)
7. `object_key` (text)
8. `mime_type` (text)
9. `size_bytes` (bigint)
10. `sha256` (text)
11. `etag` (text)
12. `source_url` (text)
13. `downloaded_at` (timestamptz)
14. `last_error` (text)
15. `created_at` / `updated_at` (timestamptz)

Indice recomendado:

1. unico por (`contrato_id`, `message_id`, `documento_id`).

## 6. Chave de objeto no MinIO

Padrao sugerido:

`dte/{contratoId}/{messageId}/{documentoId}/{sha256}.pdf`

Vantagens:

1. evita colisao;
2. facilita rastreio operacional;
3. permite dedupe por hash.

## 7. Configuracao de ambiente (alvo)

Variaveis sugeridas:

1. `OBJECT_STORAGE_PROVIDER=minio`
2. `OBJECT_STORAGE_ENABLED=true`
3. `MINIO_ENDPOINT=...`
4. `MINIO_PORT=...`
5. `MINIO_USE_SSL=true|false`
6. `MINIO_ACCESS_KEY=...`
7. `MINIO_SECRET_KEY=...`
8. `MINIO_BUCKET=...`
9. `MINIO_REGION=us-east-1` (ou equivalente)
10. `MINIO_PRESIGNED_TTL_SECONDS=300`
11. `DOC_CACHE_ENABLE_AUTOFETCH=true`
12. `DOC_CACHE_MAX_RETRIES=3`
13. `DOC_CACHE_REQUEST_TIMEOUT_MS=45000`

## 8. Politica de seguranca e compliance

1. criptografia em repouso no bucket;
2. TTL curto de URL assinada (5-10 minutos);
3. mascarar credenciais em logs;
4. trilha de auditoria por `requestId`, `jobId`, `contratoId`, `messageId`, `documentoId`;
5. politica de retencao por contrato/legal.

## 9. Fluxo recomendado para o frontend

1. chamar `GET /messages/{messageId}/view`;
2. para cada anexo, chamar endpoint de metadado de documento;
3. se `storageStatus=stored`, abrir download (`redirect` preferencial);
4. se `pending/failed`, mostrar status e opcao de retry;
5. para visualizacao imediata, permitir `autoFetch=true`.

## 10. Criterio de pronto da fase 7

1. download via MinIO funcional em `proxy` e `redirect`;
2. fallback para fetch no DTE com cache posterior;
3. integridade validada por `sha256`;
4. metrica de hit ratio de cache;
5. testes automatizados da fase (`test:phase7`) criados e verdes.

Validacao atual:

- `npm run test:phase7` (smoke da base fase 7) implementado.
