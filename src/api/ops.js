import client from './client'

export async function getHealthDte() {
  const { data } = await client.get('/v1/auth/status')
  return data.data // { authenticated, pingStatus, canRefresh, mode, ... }
}

export async function getDashboard() {
  const { data } = await client.get('/v1/ops/dashboard')
  return data.data
}

export async function startSync(params = {}) {
  const { data } = await client.post('/v1/sync/messages', params)
  return data.data // { jobId }
}
