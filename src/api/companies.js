import client from './client'

export async function getCompanies(params = {}) {
  const { data } = await client.get('/v1/companies', { params })
  return data // { data: Company[] }
}

export async function getMessages(contratoId, params = {}) {
  const { data } = await client.get(`/v1/companies/${contratoId}/messages`, { params })
  return data // { data: Message[] }
}

export async function getUnreadMessages(contratoId) {
  const { data } = await client.get(`/v1/companies/${contratoId}/messages/unread`)
  return data // { data: Message[] }
}
