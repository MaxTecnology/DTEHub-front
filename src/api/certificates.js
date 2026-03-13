import client from './client'

export async function getCertificates() {
  const { data } = await client.get('/v1/certificates')
  return data.data // Certificate[]
}

export async function getCurrentCertificate() {
  const { data } = await client.get('/v1/certificates/current')
  return data.data
}

export async function uploadCertificate(formData) {
  const { data } = await client.post('/v1/certificates/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

export async function activateCertificate(certificateId) {
  const { data } = await client.post(`/v1/certificates/${certificateId}/activate`)
  return data.data
}

export async function revokeCertificate(certificateId) {
  const { data } = await client.post(`/v1/certificates/${certificateId}/revoke`)
  return data.data
}

export async function testLoginCertificate(certificateId) {
  const { data } = await client.post(`/v1/certificates/${certificateId}/test-login`)
  return data.data // { steps, auth: { refreshed } }
}
