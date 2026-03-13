import client from './client'

export async function getJob(jobId) {
  const { data } = await client.get(`/v1/jobs/${jobId}`)
  return data.data
}

export async function getJobs(params = {}) {
  const { data } = await client.get('/v1/jobs', { params })
  return data // { data: [...], meta: {...} }
}

export async function getActiveSync() {
  const { data } = await client.get('/v1/jobs', {
    params: { status: 'pending,running', jobType: 'sync_messages', pageSize: 5 },
  })
  return data.data // array de jobs ativos
}
