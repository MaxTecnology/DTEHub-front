import client from './client'

export async function getChannels() {
  const { data } = await client.get('/v1/alerts/channels')
  return data.data // Channel[]
}

export async function createChannel(payload) {
  const { data } = await client.post('/v1/alerts/channels', payload)
  return data.data
}

/**
 * payload: { channelId, eventType, companyName, assunto }
 * response: { success, httpStatus, errorMessage, eventId, outboxId }
 */
export async function testDelivery(payload) {
  const { data } = await client.post('/v1/alerts/test-delivery', payload)
  return data.data
}

export async function getDeliveries(params = {}) {
  const { data } = await client.get('/v1/alerts/deliveries', { params })
  return data // { data: [], meta: {} }
}

/**
 * enabled: true → reativar | false → desativar
 * response: { enabled, cancelledOutboxItems, affectedEvents, ... }
 */
export async function updateChannelStatus(channelId, enabled) {
  const { data } = await client.patch(`/v1/alerts/channels/${channelId}/status`, { enabled })
  return data.data
}

/**
 * 200 → { action: 'deleted' | 'archived' }
 */
export async function deleteChannel(channelId) {
  const { data } = await client.delete(`/v1/alerts/channels/${channelId}`)
  return data.data
}

// ─── Routings ────────────────────────────────────────────────────────────────

export async function getRoutings() {
  const { data } = await client.get('/v1/alerts/routings')
  return data.data
}

export async function createRouting(payload) {
  const { data } = await client.post('/v1/alerts/routings', payload)
  return data.data
}

export async function updateRoutingStatus(routingId, enabled) {
  const { data } = await client.patch(`/v1/alerts/routings/${routingId}/status`, { enabled })
  return data.data
}

export async function deleteRouting(routingId) {
  const { data } = await client.delete(`/v1/alerts/routings/${routingId}`)
  return data.data
}

// ─── Recipients ──────────────────────────────────────────────────────────────

export async function getRecipients() {
  const { data } = await client.get('/v1/alerts/recipients')
  return data.data
}

export async function createRecipient(payload) {
  const { data } = await client.post('/v1/alerts/recipients', payload)
  return data.data
}

export async function updateRecipient(recipientId, payload) {
  const { data } = await client.patch(`/v1/alerts/recipients/${recipientId}`, payload)
  return data.data
}

export async function updateRecipientStatus(recipientId, enabled) {
  const { data } = await client.patch(`/v1/alerts/recipients/${recipientId}/status`, { enabled })
  return data.data
}

export async function deleteRecipient(recipientId) {
  const { data } = await client.delete(`/v1/alerts/recipients/${recipientId}`)
  return data.data
}
