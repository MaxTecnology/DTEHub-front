import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import CompaniesPage from './CompaniesPage'

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('CompaniesPage', () => {
  it('lista empresas ao carregar', async () => {
    setFakeSession('admin')
    renderWithProviders(<CompaniesPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('company-row')).toHaveLength(2)
    })

    expect(screen.getByText('Empresa Alpha')).toBeInTheDocument() // descricao
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument()
  })

  it('exibe badge de nao lidas quando unreadCount > 0', async () => {
    setFakeSession('admin')
    renderWithProviders(<CompaniesPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('company-row')).toHaveLength(2)
    })

    // Empresa Alpha tem 3 nao lidas (unreadMessages)
    expect(screen.getByTestId('unread-count-badge')).toHaveTextContent('3')
  })

  it('botao de filtro alterna para somente nao lidas', async () => {
    server.use(
      http.get('http://localhost:3000/v1/companies', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('onlyWithUnread') === 'true') {
          return HttpResponse.json({
            data: [{ contratoId: 'c-001', descricao: 'Empresa Alpha', documento: '58659827000191', unreadMessages: 3, totalMessages: 5 }],
            meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
          })
        }
        return HttpResponse.json({
          data: [
            { contratoId: 'c-001', descricao: 'Empresa Alpha', documento: '58659827000191', unreadMessages: 3, totalMessages: 5 },
            { contratoId: 'c-002', descricao: 'Empresa Beta', documento: '14255140000115', unreadMessages: 0, totalMessages: 0 },
          ],
          meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
        })
      })
    )

    setFakeSession('admin')
    const user = userEvent.setup()
    renderWithProviders(<CompaniesPage />)

    // Espera lista inicial
    await waitFor(() => {
      expect(screen.getAllByTestId('company-row')).toHaveLength(2)
    })

    // Clica no filtro
    await user.click(screen.getByTestId('filter-unread-btn'))

    // Deve mostrar apenas 1 empresa
    await waitFor(() => {
      expect(screen.getAllByTestId('company-row')).toHaveLength(1)
    })

    expect(screen.queryByText('Empresa Beta')).not.toBeInTheDocument()
  })

  it('navega para mensagens ao clicar na empresa', async () => {
    setFakeSession('admin')
    const user = userEvent.setup()
    renderWithProviders(<CompaniesPage />)

    await waitFor(() => {
      expect(screen.getAllByTestId('company-row')).toHaveLength(2)
    })

    await user.click(screen.getAllByTestId('company-row')[0])

    expect(window.location.pathname).toBe('/companies/c-001/messages')
  })

  it('exibe skeletons durante carregamento', () => {
    setFakeSession('admin')
    renderWithProviders(<CompaniesPage />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('exibe mensagem quando nenhuma empresa encontrada', async () => {
    server.use(
      http.get('http://localhost:3000/v1/companies', () =>
        HttpResponse.json({ data: [] })
      )
    )

    setFakeSession('admin')
    renderWithProviders(<CompaniesPage />)

    await waitFor(() => {
      expect(screen.getByText(/nenhuma empresa/i)).toBeInTheDocument()
    })
  })
})
