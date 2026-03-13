import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import MessagesPage from './MessagesPage'

// Renderiza dentro de uma Route para que useParams() funcione
function renderMessages(contratoId = 'c-001') {
  window.history.pushState({}, '', `/companies/${contratoId}/messages`)
  return renderWithProviders(
    <Routes>
      <Route path="/companies/:contratoId/messages" element={<MessagesPage />} />
    </Routes>
  )
}

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('MessagesPage', () => {
  it('lista mensagens ao carregar', async () => {
    setFakeSession('operator')
    renderMessages()

    await waitFor(() => {
      expect(screen.getAllByTestId('message-row')).toHaveLength(2)
    })

    expect(screen.getByText('Notificacao fiscal')).toBeInTheDocument() // assunto
    expect(screen.getByText('Confirmacao de cadastro')).toBeInTheDocument()
  })

  it('mensagem nao_lida tem destaque visual', async () => {
    setFakeSession('operator')
    renderMessages()

    await waitFor(() => {
      expect(screen.getAllByTestId('message-row')).toHaveLength(2)
    })

    const unreadRow = document.querySelector('[data-read-state="nao_lida"]')
    expect(unreadRow).toHaveClass('bg-blue-50')
  })

  it('filtro Nao lidas exibe apenas mensagens nao_lida', async () => {
    setFakeSession('operator')
    const user = userEvent.setup()
    renderMessages()

    await waitFor(() => {
      expect(screen.getAllByTestId('message-row')).toHaveLength(2)
    })

    await user.click(screen.getByTestId('filter-nao_lida'))

    await waitFor(() => {
      expect(screen.getAllByTestId('message-row')).toHaveLength(1)
    })

    expect(screen.queryByText('Confirmacao de cadastro')).not.toBeInTheDocument() // assunto lida
  })

  it('filtro Todos restaura lista completa', async () => {
    setFakeSession('operator')
    const user = userEvent.setup()
    renderMessages()

    await waitFor(() => {
      expect(screen.getAllByTestId('message-row')).toHaveLength(2)
    })

    // Ativa filtro nao_lida
    await user.click(screen.getByTestId('filter-nao_lida'))
    await waitFor(() => {
      expect(screen.getAllByTestId('message-row')).toHaveLength(1)
    })

    // Volta para todos
    await user.click(screen.getByTestId('filter-all'))
    await waitFor(() => {
      expect(screen.getAllByTestId('message-row')).toHaveLength(2)
    })
  })

  it('exibe badges de estado corretas', async () => {
    setFakeSession('operator')
    renderMessages()

    await waitFor(() => {
      expect(screen.getAllByTestId('read-state-badge')).toHaveLength(2)
    })

    const badges = screen.getAllByTestId('read-state-badge')
    const states = badges.map((b) => b.getAttribute('data-state'))
    expect(states).toContain('nao_lida')
    expect(states).toContain('lida')
  })

  it('navega para detalhe ao clicar na mensagem', async () => {
    setFakeSession('operator')
    const user = userEvent.setup()
    renderMessages()

    await waitFor(() => {
      expect(screen.getAllByTestId('message-row')).toHaveLength(2)
    })

    await user.click(screen.getAllByTestId('message-row')[0])

    expect(window.location.pathname).toMatch(/\/companies\/c-001\/messages\//)
  })
})
