import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import AdminCertificatesPage from './AdminCertificatesPage'

function renderCerts() {
  window.history.pushState({}, '', '/admin/certificates')
  return renderWithProviders(
    <Routes>
      <Route path="/admin/certificates" element={<AdminCertificatesPage />} />
    </Routes>
  )
}

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('AdminCertificatesPage', () => {
  it('exibe lista de certificados', async () => {
    setFakeSession('admin')
    renderCerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('cert-row')).toHaveLength(2)
    })

    expect(screen.getAllByText('Certificado A1 2025').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Certificado antigo')).toBeInTheDocument()
  })

  it('exibe badge de status dos certificados', async () => {
    setFakeSession('admin')
    renderCerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('cert-status-badge')).toHaveLength(2)
    })

    const badges = screen.getAllByTestId('cert-status-badge')
    const texts = badges.map((b) => b.textContent)
    expect(texts).toContain('Ativo')
    expect(texts).toContain('Revogado')
  })

  it('exibe botao enviar certificado', async () => {
    setFakeSession('admin')
    renderCerts()

    await waitFor(() => {
      expect(screen.getByTestId('upload-cert-btn')).toBeInTheDocument()
    })
  })

  it('abre dialog de upload ao clicar no botao', async () => {
    setFakeSession('admin')
    const user = userEvent.setup()
    renderCerts()

    await waitFor(() => {
      expect(screen.getByTestId('upload-cert-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('upload-cert-btn'))
    expect(screen.getByText('Enviar certificado PFX')).toBeInTheDocument()
  })

  it('certificado ativo aparece em destaque', async () => {
    setFakeSession('admin')
    renderCerts()

    await waitFor(() => {
      expect(screen.getByText('Certificado ativo')).toBeInTheDocument()
    })
  })

  it('botao ativar visivel para certificado nao ativo', async () => {
    setFakeSession('admin')
    renderCerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('cert-row')).toHaveLength(2)
    })

    // cert-002 (revoked) deve ter botao ativar
    expect(screen.getByTestId('activate-cert-btn')).toBeInTheDocument()
  })

  it('botao revogar visivel para certificado ativo', async () => {
    setFakeSession('admin')
    renderCerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('cert-row')).toHaveLength(2)
    })

    expect(screen.getByTestId('revoke-cert-btn')).toBeInTheDocument()
  })

  it('teste de login exibe resultado', async () => {
    setFakeSession('admin')
    const user = userEvent.setup()
    renderCerts()

    await waitFor(() => {
      expect(screen.getAllByTestId('test-cert-btn')).toHaveLength(2)
    })

    await user.click(screen.getAllByTestId('test-cert-btn')[0])

    await waitFor(() => {
      expect(screen.getByTestId('test-result-card')).toBeInTheDocument()
    })

    expect(screen.getByText('Autenticação renovada com sucesso.')).toBeInTheDocument()
  })
})
