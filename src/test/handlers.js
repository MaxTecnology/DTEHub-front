import { http, HttpResponse } from 'msw'

const BASE_URL = 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authHandlers = [
  http.post(`${BASE_URL}/v1/users/login`, () => {
    return HttpResponse.json({
      data: {
        accessToken: 'fake-token-123',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        user: { id: 'user-1', email: 'admin@dte.com', role: 'admin', status: 'active' },
      },
    })
  }),

  http.get(`${BASE_URL}/v1/users/me`, () => {
    return HttpResponse.json({
      id: 'user-1',
      email: 'admin@dte.com',
      role: 'admin',
      status: 'active',
    })
  }),

  http.post(`${BASE_URL}/v1/users/logout`, () => {
    return HttpResponse.json({ ok: true })
  }),
]

// ---------------------------------------------------------------------------
// Health / Dashboard
// ---------------------------------------------------------------------------
export const opsHandlers = [
  http.get(`${BASE_URL}/v1/auth/status`, () => {
    return HttpResponse.json({
      data: {
        checkedAt: new Date().toISOString(),
        mode: 'pfx',
        canRefresh: true,
        authenticated: true,
        pingStatus: 200,
        sub: 'user-1',
        requiredActions: [],
        reason: null,
      },
    })
  }),

  http.get(`${BASE_URL}/v1/ops/dashboard`, () => {
    return HttpResponse.json({
      data: {
        companies: { total: 5, withUnread: 3 },
        messages: { total: 50, unread: 12, read: 38, lastMessageUpdateAt: new Date().toISOString() },
        syncJobs: { pending: 0, running: 0, failed: 0, lastSuccessAt: new Date().toISOString() },
      },
    })
  }),
]

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------
export const companiesHandlers = [
  http.get(`${BASE_URL}/v1/companies`, () => {
    return HttpResponse.json({
      data: [
        { contratoId: 'c-001', descricao: 'Empresa Alpha', documento: '58659827000191', inscricaoCompleta: '24141698-1', tipo: 'procurador', situacao: 'assinado', unreadMessages: 3, totalMessages: 5, updatedAt: new Date().toISOString() },
        { contratoId: 'c-002', descricao: 'Empresa Beta', documento: '14255140000115', inscricaoCompleta: null, tipo: 'contribuinte', situacao: null, unreadMessages: 0, totalMessages: 0, updatedAt: new Date().toISOString() },
      ],
      meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    })
  }),
]

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export const messagesHandlers = [
  http.get(`${BASE_URL}/v1/companies/:contratoId/messages`, ({ params }) => {
    return HttpResponse.json({
      data: [
        {
          messageId: 'msg-001',
          assunto: 'Notificacao fiscal',
          readState: 'nao_lida',
          messageDate: '2026-03-10',
          documentsCount: 1,
          hasResponses: false,
        },
        {
          messageId: 'msg-002',
          assunto: 'Confirmacao de cadastro',
          readState: 'lida',
          messageDate: '2025-07-21',
          documentsCount: 2,
          hasResponses: false,
        },
      ],
      meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    })
  }),

  http.get(`${BASE_URL}/v1/companies/:contratoId/messages/unread`, () => {
    return HttpResponse.json({
      data: [
        {
          messageId: 'msg-001',
          assunto: 'Notificacao fiscal',
          readState: 'nao_lida',
          messageDate: '2026-03-10',
          documentsCount: 1,
          hasResponses: false,
        },
      ],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })
  }),

  http.get(`${BASE_URL}/v1/companies/:contratoId/messages/:messageId`, ({ params }) => {
    return HttpResponse.json({
      data: {
        messageId: params.messageId,
        contratoId: params.contratoId,
        assunto: 'Notificacao fiscal de ICMS',
        descricao: 'Prezado contribuinte, segue notificacao fiscal referente ao periodo.',
        messageDate: '2025-01-15',
        readState: 'nao_lida',
        readAt: null,
        documentsCount: 2,
        hasResponses: false,
        documents: [
          { documentoId: 'doc-001', nomeOriginal: 'nfe-001.pdf', cachedAt: null },
          { documentoId: 'doc-002', nomeOriginal: 'anexo-001.pdf', cachedAt: '2025-01-15T12:00:00.000Z' },
        ],
      },
    })
  }),

  http.get(`${BASE_URL}/v1/companies/:contratoId/messages/:messageId/view`, ({ params }) => {
    return HttpResponse.json({
      data: {
        messageId: params.messageId,
        assunto: 'Notificacao fiscal de ICMS',
        descricao: 'Prezado contribuinte, segue notificacao fiscal referente ao periodo.',
        messageDate: '2025-01-15',
        readState: 'nao_lida',
        documents: [
          { documentoId: 'doc-001', nomeOriginal: 'nfe-001.pdf', apiDownloadUrl: `/v1/companies/${params.contratoId}/messages/${params.messageId}/documents/doc-001/download` },
          { documentoId: 'doc-002', nomeOriginal: 'anexo-001.pdf', apiDownloadUrl: `/v1/companies/${params.contratoId}/messages/${params.messageId}/documents/doc-002/download` },
        ],
      },
    })
  }),

  http.post(
    `${BASE_URL}/v1/companies/:contratoId/messages/:messageId/documents/:documentoId/cache`,
    () => {
      return HttpResponse.json({ ok: true })
    }
  ),

  http.get(
    `${BASE_URL}/v1/companies/:contratoId/messages/:messageId/documents/:documentoId/download`,
    () => {
      return new HttpResponse(new Blob(['fake-pdf-content'], { type: 'application/pdf' }), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="nfe-001.pdf"',
        },
      })
    }
  ),
]

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
export const jobsHandlers = [
  http.post(`${BASE_URL}/v1/sync/messages`, () => {
    return HttpResponse.json({ data: { jobId: 'job-abc-123' } }, { status: 202 })
  }),

  http.get(`${BASE_URL}/v1/jobs/:jobId`, () => {
    return HttpResponse.json({
      data: {
        jobId: 'job-abc-123',
        status: 'completed',
        resultSummary: { total: 10, new: 2, updated: 3 },
      },
    })
  }),
]

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export const alertsHandlers = [
  http.get(`${BASE_URL}/v1/alerts/channels`, () => {
    return HttpResponse.json({
      data: [
        { id: 'ch-001', name: 'Slack producao', url: 'https://hooks.slack.com/abc', type: 'webhook', active: true },
        { id: 'ch-002', name: 'Teams dev', url: 'https://hooks.teams.com/xyz', type: 'webhook', active: false },
      ],
    })
  }),

  http.post(`${BASE_URL}/v1/alerts/channels`, () => {
    return HttpResponse.json({
      data: { id: 'ch-003', name: 'Novo canal', url: 'https://hooks.slack.com/new', type: 'webhook', active: true },
    })
  }),

  http.get(`${BASE_URL}/v1/alerts/deliveries`, () => {
    return HttpResponse.json({
      data: [
        { id: 'del-001', channelName: 'Slack producao', status: 'sent', sentAt: new Date().toISOString() },
        { id: 'del-002', channelName: 'Teams dev', status: 'failed', sentAt: new Date().toISOString() },
      ],
    })
  }),
]

// ---------------------------------------------------------------------------
// Users (admin)
// ---------------------------------------------------------------------------
export const usersHandlers = [
  http.get(`${BASE_URL}/v1/users`, () => {
    return HttpResponse.json({
      data: [
        { id: 'u-001', email: 'admin@dte.com', fullName: 'Admin User', role: 'admin', isActive: true, createdAt: new Date().toISOString() },
        { id: 'u-002', email: 'op@dte.com', fullName: 'Operador', role: 'operator', isActive: true, createdAt: new Date().toISOString() },
        { id: 'u-003', email: 'viewer@dte.com', fullName: 'Viewer', role: 'viewer', isActive: false, createdAt: new Date().toISOString() },
      ],
    })
  }),

  http.post(`${BASE_URL}/v1/users`, () => {
    return HttpResponse.json({
      data: { id: 'u-004', email: 'novo@dte.com', fullName: 'Novo Usuario', role: 'operator', isActive: true, createdAt: new Date().toISOString() },
    }, { status: 201 })
  }),

  http.patch(`${BASE_URL}/v1/users/:userId/status`, () => {
    return HttpResponse.json({ data: { ok: true } })
  }),

  http.post(`${BASE_URL}/v1/users/:userId/reset-password`, () => {
    return HttpResponse.json({ data: { ok: true } })
  }),

  http.get(`${BASE_URL}/v1/users/audit`, () => {
    return HttpResponse.json({
      data: [
        { id: 'al-001', action: 'login', userEmail: 'admin@dte.com', createdAt: new Date().toISOString() },
        { id: 'al-002', action: 'logout', userEmail: 'op@dte.com', createdAt: new Date().toISOString() },
      ],
    })
  }),
]

// ---------------------------------------------------------------------------
// Certificates (admin)
// ---------------------------------------------------------------------------
export const certificatesHandlers = [
  http.get(`${BASE_URL}/v1/certificates`, () => {
    return HttpResponse.json({
      data: [
        { id: 'cert-001', label: 'Certificado A1 2025', status: 'active', expiresAt: '2025-12-31T00:00:00.000Z', lastTestedAt: new Date().toISOString() },
        { id: 'cert-002', label: 'Certificado antigo', status: 'revoked', expiresAt: '2024-01-01T00:00:00.000Z', lastTestedAt: null },
      ],
    })
  }),

  http.get(`${BASE_URL}/v1/certificates/current`, () => {
    return HttpResponse.json({
      data: { id: 'cert-001', label: 'Certificado A1 2025', status: 'active', expiresAt: '2025-12-31T00:00:00.000Z' },
    })
  }),

  http.post(`${BASE_URL}/v1/certificates/upload`, () => {
    return HttpResponse.json({
      data: { id: 'cert-003', label: 'Novo cert', status: 'pending' },
    }, { status: 201 })
  }),

  http.post(`${BASE_URL}/v1/certificates/:certificateId/activate`, () => {
    return HttpResponse.json({ data: { ok: true } })
  }),

  http.post(`${BASE_URL}/v1/certificates/:certificateId/revoke`, () => {
    return HttpResponse.json({ data: { ok: true } })
  }),

  http.post(`${BASE_URL}/v1/certificates/:certificateId/test-login`, () => {
    return HttpResponse.json({
      data: {
        steps: ['ping OK', 'login OK', 'contratos OK'],
        auth: { refreshed: true },
      },
    })
  }),
]

// ---------------------------------------------------------------------------
// Handlers padrao (usados em todos os testes)
// ---------------------------------------------------------------------------
export const handlers = [
  ...authHandlers,
  ...opsHandlers,
  ...companiesHandlers,
  ...messagesHandlers,
  ...jobsHandlers,
  ...alertsHandlers,
  ...usersHandlers,
  ...certificatesHandlers,
]
