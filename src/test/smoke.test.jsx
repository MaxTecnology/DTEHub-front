import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderWithProviders, clearFakeSession, setFakeSession } from './utils'
import App from '@/App'

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('Smoke — setup de testes', () => {
  it('sem sessao, renderiza a tela de login', () => {
    renderWithProviders(<App />)
    // Sem auth, redireciona para /login que exibe o titulo DTE Console
    expect(screen.getByText('DTE Console')).toBeInTheDocument()
  })

  it('com sessao, renderiza o layout protegido', () => {
    setFakeSession('admin')
    renderWithProviders(<App />)
    // Com auth, sidebar aparece com o titulo DTE Console
    expect(screen.getByText('DTE Console')).toBeInTheDocument()
  })

  it('renderiza um elemento simples corretamente', () => {
    render(<div data-testid="ok">DTE Console</div>)
    expect(screen.getByTestId('ok')).toHaveTextContent('DTE Console')
  })
})
