import client from './client'

export async function getUsers(params = {}) {
  const { data } = await client.get('/v1/users', { params })
  return data.data // User[]
}

export async function createUser(payload) {
  const { data } = await client.post('/v1/users', payload)
  return data.data
}

export async function patchUserStatus(userId, status) {
  const { data } = await client.patch(`/v1/users/${userId}/status`, { status })
  return data.data
}

export async function resetPassword(userId, payload) {
  const { data } = await client.post(`/v1/users/${userId}/reset-password`, payload)
  return data.data
}

export async function getAuditLogs(params = {}) {
  const { data } = await client.get('/v1/users/audit', { params })
  return data.data // AuditLog[]
}
