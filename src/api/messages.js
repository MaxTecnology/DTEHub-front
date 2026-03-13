import client from './client'

export async function getMessage(contratoId, messageId) {
  const { data } = await client.get(
    `/v1/companies/${contratoId}/messages/${messageId}`
  )
  return data.data
}

export async function getMessageView(contratoId, messageId) {
  const { data } = await client.get(
    `/v1/companies/${contratoId}/messages/${messageId}/view`
  )
  return data.data // { assunto, descricao, messageDate, documents, ... }
}

export async function downloadDocument(contratoId, messageId, documentoId) {
  const response = await client.get(
    `/v1/companies/${contratoId}/messages/${messageId}/documents/${documentoId}/download`,
    { params: { delivery: 'proxy' }, responseType: 'blob' }
  )

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/octet-stream',
  })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = getFilenameFromHeaders(response.headers) || `documento-${documentoId}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

function getFilenameFromHeaders(headers) {
  const disposition = headers['content-disposition'] || ''
  const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n]*)\1/)
  return match ? match[2] : null
}
