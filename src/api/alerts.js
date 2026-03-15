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
 * 200 → removido | 409 → possui histórico, não pode ser excluído
 */
export async function deleteChannel(channelId) {
  const { data } = await client.delete(`/v1/alerts/channels/${channelId}`)
  return data.data
}
