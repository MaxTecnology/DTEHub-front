import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import DashboardPage from './DashboardPage'

afterEach(() => {
  clearFakeSession()
})

describe('DashboardPage', () => {
  it('renderiza os 4 cards ao carregar', async () => {
    setFakeSession('admin')
    renderWithProviders(<DashboardPage />)

    // Espera os dados carregarem
    await waitFor(() => {
      expect(screen.getByTestId('dte-status-badge')).toBeInTheDocument()
    })

    expect(screen.getByTestId('total-companies')).toHaveTextContent('5')
    expect(screen.getByTestId('total-unread')).toHaveTextContent('12')
    expect(screen.getByTestId('last-sync')).toBeInTheDocument()
  })

  it('badge UP aparece verde (sem banner)', async () => {
    setFakeSession('admin')
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByTestId('dte-status-badge')).toBeInTheDocument()
    })

    expect(screen.getByTestId('dte-status-badge')).toHaveTextContent('Operacional')
    expect(screen.queryByTestId('dte-banner')).not.toBeInTheDocument()
  })

  it('exibe banner quando DTE esta DEGRADED', async () => {
    server.use(
      http.get('http://localhost:3000/v1/auth/status', () =>
        HttpResponse.json({
          data: { authenticated: false, pingStatus: 200, checkedAt: new Date().toISOString(), mode: 'pfx', canRefresh: false, sub: '-1', requiredActions: [], reason: 'Unauthenticated.' },
        })
      )
    )

    setFakeSession('admin')
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByTestId('dte-banner')).toBeInTheDocument()
    })

    expect(screen.getByText(/instabilidade/i)).toBeInTheDocument()
    expect(screen.getByTestId('dte-status-badge')).toHaveTextContent('Degradado')
  })

  it('exibe banner quando DTE esta DOWN', async () => {
    server.use(
      http.get('http://localhost:3000/v1/auth/status', () =>
        HttpResponse.json({
          data: { authenticated: false, pingStatus: 503, checkedAt: new Date().toISOString(), mode: 'pfx', canRefresh: false, sub: '-1', requiredActions: [], reason: 'Portal unavailable.' },
        })
      )
    )

    setFakeSession('admin')
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByTestId('dte-banner')).toBeInTheDocument()
    })

    expect(screen.getByTestId('dte-banner')).toHaveTextContent(/fora do ar/i)
    expect(screen.getByTestId('dte-status-badge')).toHaveTextContent('Indisponível')
  })

  it('botao de sync visivel para operator', async () => {
    setFakeSession('operator')
    renderWithProviders(<DashboardPage />)

    expect(screen.getByRole('button', { name: /sincronizar/i })).toBeInTheDocument()
  })

  it('botao de sync invisivel para viewer', async () => {
    setFakeSession('viewer')
    renderWithProviders(<DashboardPage />)

    expect(screen.queryByRole('button', { name: /sincronizar/i })).not.toBeInTheDocument()
  })

  it('dispara sync ao clicar e navega para /jobs', async () => {
    setFakeSession('admin')
    const user = userEvent.setup()
    renderWithProviders(<DashboardPage />)

    await user.click(screen.getByRole('button', { name: /sincronizar/i }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/jobs')
    })
  })

  it('exibe skeletons enquanto carrega', () => {
    setFakeSession('admin')
    renderWithProviders(<DashboardPage />)

    // Antes dos dados chegarem os skeletons aparecem
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
