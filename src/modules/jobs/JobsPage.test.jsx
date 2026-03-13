import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import JobsPage from './JobsPage'

function renderJobs(search = '') {
  const path = `/jobs${search}`
  window.history.pushState({}, '', path)
  return renderWithProviders(
    <Routes>
      <Route path="/jobs" element={<JobsPage />} />
    </Routes>
  )
}

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('JobsPage', () => {
  it('exibe mensagem quando nenhum jobId na URL', () => {
    setFakeSession('operator')
    renderJobs()
    expect(screen.getByTestId('no-job-message')).toBeInTheDocument()
  })

  it('exibe card do job quando jobId esta na URL', async () => {
    setFakeSession('operator')
    renderJobs('?jobId=job-abc-123')

    await waitFor(() => {
      expect(screen.getByTestId('job-card')).toBeInTheDocument()
    })
  })

  it('exibe badge de status do job', async () => {
    setFakeSession('operator')
    renderJobs('?jobId=job-abc-123')

    await waitFor(() => {
      expect(screen.getByTestId('job-status-badge')).toHaveTextContent('Concluído')
    })
  })

  it('exibe resultado da sincronizacao quando completed', async () => {
    setFakeSession('operator')
    renderJobs('?jobId=job-abc-123')

    await waitFor(() => {
      expect(screen.getByTestId('job-result')).toBeInTheDocument()
    })

    expect(screen.getByText(/Total: 10/)).toBeInTheDocument()
    expect(screen.getByText(/Novas: 2/)).toBeInTheDocument()
    expect(screen.getByText(/Atualizadas: 3/)).toBeInTheDocument()
  })

  it('botao novo sync visivel para operator', () => {
    setFakeSession('operator')
    renderJobs()
    expect(screen.getByTestId('new-sync-btn')).toBeInTheDocument()
  })

  it('botao novo sync visivel para admin', () => {
    setFakeSession('admin')
    renderJobs()
    expect(screen.getByTestId('new-sync-btn')).toBeInTheDocument()
  })

  it('botao novo sync invisivel para viewer', () => {
    setFakeSession('viewer')
    renderJobs()
    expect(screen.queryByTestId('new-sync-btn')).not.toBeInTheDocument()
  })

  it('clicar em novo sync inicia job e exibe card', async () => {
    setFakeSession('operator')
    const user = userEvent.setup()
    renderJobs()

    await user.click(screen.getByTestId('new-sync-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('job-card')).toBeInTheDocument()
    })
  })
})
