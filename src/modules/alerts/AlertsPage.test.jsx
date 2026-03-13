import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import AlertsPage from './AlertsPage'

function renderAlerts() {
  window.history.pushState({}, '', '/alerts')
  return renderWithProviders(
    <Routes>
      <Route path="/alerts" element={<AlertsPage />} />
    </Routes>
  )
}

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('AlertsPage', () => {
  it('exibe lista de canais', async () => {
    setFakeSession('operator')
    renderAlerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('channel-row')).toHaveLength(2)
    })

    expect(screen.getAllByText('Slack producao').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Teams dev').length).toBeGreaterThanOrEqual(1)
  })

  it('exibe badge de status dos canais', async () => {
    setFakeSession('operator')
    renderAlerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('channel-status-badge')).toHaveLength(2)
    })

    const badges = screen.getAllByTestId('channel-status-badge')
    const texts = badges.map((b) => b.textContent)
    expect(texts).toContain('Ativo')
    expect(texts).toContain('Inativo')
  })

  it('exibe lista de entregas', async () => {
    setFakeSession('operator')
    renderAlerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('delivery-row')).toHaveLength(2)
    })
  })

  it('botao adicionar canal visivel para admin', async () => {
    setFakeSession('admin')
    renderAlerts()

    await waitFor(() => {
      expect(screen.getByTestId('add-channel-btn')).toBeInTheDocument()
    })
  })

  it('botao adicionar canal invisivel para operator', async () => {
    setFakeSession('operator')
    renderAlerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('channel-row')).toHaveLength(2)
    })

    expect(screen.queryByTestId('add-channel-btn')).not.toBeInTheDocument()
  })

  it('admin pode abrir dialog e criar canal', async () => {
    setFakeSession('admin')
    const user = userEvent.setup()
    renderAlerts()

    await waitFor(() => {
      expect(screen.getByTestId('add-channel-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('add-channel-btn'))
    expect(screen.getByText('Adicionar canal de notificação')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Ex: Slack produção'), 'Meu canal')
    await user.type(
      screen.getByPlaceholderText('https://hooks.slack.com/...'),
      'https://hooks.slack.com/test'
    )
    await user.click(screen.getByTestId('submit-channel-btn'))

    await waitFor(() => {
      expect(screen.queryByText('Adicionar canal de notificação')).not.toBeInTheDocument()
    })
  })
})
