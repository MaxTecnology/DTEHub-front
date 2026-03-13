import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import AdminUsersPage from './AdminUsersPage'

function renderAdminUsers() {
  window.history.pushState({}, '', '/admin/users')
  return renderWithProviders(
    <Routes>
      <Route path="/admin/users" element={<AdminUsersPage />} />
    </Routes>
  )
}

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('AdminUsersPage', () => {
  it('exibe lista de usuarios', async () => {
    setFakeSession('admin')
    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getAllByTestId('user-row')).toHaveLength(3)
    })

    expect(screen.getByText('Admin User')).toBeInTheDocument()
    expect(screen.getByText('op@dte.com')).toBeInTheDocument()
    expect(screen.getByText('viewer@dte.com')).toBeInTheDocument()
  })

  it('exibe badge de status ativo e inativo', async () => {
    setFakeSession('admin')
    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getAllByTestId('user-status-badge')).toHaveLength(3)
    })

    const badges = screen.getAllByTestId('user-status-badge')
    const texts = badges.map((b) => b.textContent)
    expect(texts).toContain('Ativo')
    expect(texts).toContain('Inativo')
  })

  it('exibe botao criar usuario', async () => {
    setFakeSession('admin')
    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByTestId('create-user-btn')).toBeInTheDocument()
    })
  })

  it('abre dialog de criar usuario', async () => {
    setFakeSession('admin')
    const user = userEvent.setup()
    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByTestId('create-user-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('create-user-btn'))
    expect(screen.getByRole('heading', { name: 'Criar usuário' })).toBeInTheDocument()
  })

  it('dialog de criar usuario tem campos corretos', async () => {
    setFakeSession('admin')
    const user = userEvent.setup()
    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByTestId('create-user-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('create-user-btn'))

    expect(screen.getByPlaceholderText('João Silva')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('joao@empresa.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByTestId('role-select')).toBeInTheDocument()
    expect(screen.getByTestId('submit-create-user-btn')).toBeInTheDocument()
  })

  it('exibe aba de auditoria ao clicar', async () => {
    setFakeSession('admin')
    const user = userEvent.setup()
    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getByTestId('tab-audit')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('tab-audit'))

    await waitFor(() => {
      expect(screen.getAllByTestId('audit-row')).toHaveLength(2)
    })
  })

  it('botoes de toggle status e reset estao presentes', async () => {
    setFakeSession('admin')
    renderAdminUsers()

    await waitFor(() => {
      expect(screen.getAllByTestId('toggle-status-btn')).toHaveLength(3)
    })

    expect(screen.getAllByTestId('reset-password-btn')).toHaveLength(3)
  })
})
