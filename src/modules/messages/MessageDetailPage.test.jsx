import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import MessageDetailPage from './MessageDetailPage'

function renderDetail(contratoId = 'c-001', messageId = 'msg-001') {
  window.history.pushState({}, '', `/companies/${contratoId}/messages/${messageId}`)
  return renderWithProviders(
    <Routes>
      <Route
        path="/companies/:contratoId/messages/:messageId"
        element={<MessageDetailPage />}
      />
    </Routes>
  )
}

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('MessageDetailPage', () => {
  it('exibe skeleton enquanto carrega', () => {
    setFakeSession('operator')
    renderDetail()
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('exibe assunto da mensagem apos carregar', async () => {
    setFakeSession('operator')
    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Notificacao fiscal de ICMS')).toBeInTheDocument()
    })
  })

  it('exibe conteudo da mensagem', async () => {
    setFakeSession('operator')
    renderDetail()

    await waitFor(() => {
      expect(screen.getByTestId('message-content')).toBeInTheDocument()
    })

    expect(screen.getByTestId('message-content').textContent).toContain('notificacao fiscal')
  })

  it('exibe lista de documentos', async () => {
    setFakeSession('operator')
    renderDetail()

    await waitFor(() => {
      expect(screen.getAllByTestId('document-row')).toHaveLength(2)
    })

    expect(screen.getByText('nfe-001.pdf')).toBeInTheDocument()
    expect(screen.getByText('anexo-001.pdf')).toBeInTheDocument()
  })

  it('exibe botao download em todos os documentos', async () => {
    setFakeSession('operator')
    renderDetail()

    await waitFor(() => {
      expect(screen.getAllByTestId('document-row')).toHaveLength(2)
    })

    const downloadBtns = screen.getAllByTestId('download-btn')
    expect(downloadBtns).toHaveLength(2)
  })

  it('botao voltar navega para lista de mensagens', async () => {
    setFakeSession('operator')
    const user = userEvent.setup()
    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Notificacao fiscal de ICMS')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Mensagens'))

    expect(window.location.pathname).toBe('/companies/c-001/messages')
  })
})
