import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, setFakeSession, clearFakeSession } from '@/test/utils'
import { RequireAuth, RequireRole } from './guards'

afterEach(() => {
  clearFakeSession()
  window.history.pushState({}, '', '/')
})

describe('RequireAuth', () => {
  it('redireciona para /login quando nao autenticado', () => {
    renderWithProviders(
      <RequireAuth>
        <p>conteudo protegido</p>
      </RequireAuth>
    )
    expect(screen.queryByText('conteudo protegido')).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('renderiza conteudo quando autenticado', () => {
    setFakeSession('viewer')
    renderWithProviders(
      <RequireAuth>
        <p>conteudo protegido</p>
      </RequireAuth>
    )
    expect(screen.getByText('conteudo protegido')).toBeInTheDocument()
  })
})

describe('RequireRole', () => {
  it('exibe acesso negado quando role insuficiente', () => {
    setFakeSession('viewer')
    renderWithProviders(
      <RequireRole roles={['admin', 'owner']}>
        <p>area admin</p>
      </RequireRole>
    )
    expect(screen.queryByText('area admin')).not.toBeInTheDocument()
    expect(screen.getByText(/acesso negado/i)).toBeInTheDocument()
  })

  it('renderiza conteudo quando role suficiente', () => {
    setFakeSession('admin')
    renderWithProviders(
      <RequireRole roles={['admin', 'owner']}>
        <p>area admin</p>
      </RequireRole>
    )
    expect(screen.getByText('area admin')).toBeInTheDocument()
  })

  it('viewer nao acessa rota de operator', () => {
    setFakeSession('viewer')
    renderWithProviders(
      <RequireRole roles={['operator', 'admin', 'owner']}>
        <p>area operator</p>
      </RequireRole>
    )
    expect(screen.queryByText('area operator')).not.toBeInTheDocument()
    expect(screen.getByText(/acesso negado/i)).toBeInTheDocument()
  })

  it('operator acessa rota de operator', () => {
    setFakeSession('operator')
    renderWithProviders(
      <RequireRole roles={['operator', 'admin', 'owner']}>
        <p>area operator</p>
      </RequireRole>
    )
    expect(screen.getByText('area operator')).toBeInTheDocument()
  })
})
