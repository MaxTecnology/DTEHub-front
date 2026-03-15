# Integracao n8n - Alertas DTE

Arquivo de workflow para importar:

- `docs/n8n-dte-alerts-workflow.json`

## Objetivo

Receber alertas da API DTE no n8n com validacao de:

- `x-webhook-token`
- `x-dte-signature`

E responder `204` rapidamente ao worker da API.

## O que trocar apos importar

No node `Validate DTE Alert`, altere estes placeholders:

- `__CHANGE_ME_WEBHOOK_TOKEN__`
- `__CHANGE_ME_HMAC_SECRET__`

Os valores devem ser os mesmos configurados no canal da API:

- `headersJson.x-webhook-token`
- `secret`

## Configuracao recomendada no n8n

1. importar `docs/n8n-dte-alerts-workflow.json`
2. confirmar que o node `Receive DTE Alert` esta com:
   - `POST`
   - path `dte-alerts`
   - `responseMode = responseNode`
   - `rawBody = true`
3. ativar/publicar o workflow
4. copiar a `Production URL`
5. usar essa URL no canal webhook da API

## Como testar

1. crie o canal webhook na API apontando para a Production URL do n8n
2. copie o `channelId`
3. rode `POST /v1/alerts/test-delivery`
4. confira:
   - execucao no n8n
   - resposta `204` no webhook
   - entrega em `GET /v1/alerts/deliveries`

## Observacoes

- a rota `POST /v1/alerts/test-delivery` testa o canal diretamente e nao depende de regra/subscription
- esse workflow e propositalmente minimo: validar, aceitar e responder
- depois do `Validate DTE Alert`, voce pode adicionar:
  - `HTTP Request` para Evolution API
  - envio de email
  - gravacao em banco/CRM/Slack

## Campos uteis no payload validado

Depois do node `Validate DTE Alert`, os campos mais uteis ficam em:

- `eventType`
- `companyName`
- `contratoId`
- `assunto`
- `messageId`
- `unreadLink`
- `payload`

## Configuracao de destinatarios

No estado atual do produto:

1. a API envia o evento para o n8n;
2. o n8n decide para quem enviar (email, WhatsApp, etc.);
3. o cadastro de destinatarios ainda nao existe na API.

Recomendacao:

1. para entrar em producao agora, mantenha a lista de destinatarios no workflow do n8n;
2. para a proxima fase, mover esse cadastro para a API e deixar o n8n apenas como orquestrador de entrega.
