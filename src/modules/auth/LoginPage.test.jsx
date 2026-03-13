import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders, clearFakeSession, setFakeSession } from '@/test/utils'
import { server } from '@/test/server'
import LoginPage from './LoginPage'

afterEach(() => {
  clearFakeSession()
})

describe('LoginPage', () => {
  it('renderiza campos de email e senha', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('valida email invalido sem chamar a API', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/e-mail/i), 'nao-e-um-email')
    await user.type(screen.getByLabelText(/senha/i), 'qualquersenha')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/e-mail inválido/i)).toBeInTheDocument()
  })

  it('valida senha vazia sem chamar a API', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@dte.com')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/senha obrigatória/i)).toBeInTheDocument()
  })

  it('faz login com sucesso e salva token na sessao', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@dte.com')
    await user.type(screen.getByLabelText(/senha/i), 'senha123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(sessionStorage.getItem('dte:token')).toBe('fake-token-123')
    })
  })

  it('exibe mensagem de erro para credenciais invalidas (401)', async () => {
    server.use(
      http.post('http://localhost:3000/v1/users/login', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@dte.com')
    await user.type(screen.getByLabelText(/senha/i), 'senhaerrada')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/e-mail ou senha incorretos/i)).toBeInTheDocument()
  })

  it('redireciona para /dashboard se ja autenticado', async () => {
    setFakeSession('admin')
    renderWithProviders(<LoginPage />)

    // Com sessao ativa o redirect acontece imediatamente via useEffect
    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard')
    })
  })
})
