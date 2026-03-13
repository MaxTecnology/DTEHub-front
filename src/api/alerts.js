import client from './client'

export async function getChannels() {
  const { data } = await client.get('/v1/alerts/channels')
  return data.data // Channel[]
}

export async function createChannel(payload) {
  const { data } = await client.post('/v1/alerts/channels', payload)
  return data.data
}

export async function getDeliveries(params = {}) {
  const { data } = await client.get('/v1/alerts/deliveries', { params })
  return data.data // Delivery[]
}
