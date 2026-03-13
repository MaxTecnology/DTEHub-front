import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { SessionProvider } from '@/store/session'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(ui, options = {}) {
  const { initialEntries, queryClient, ...renderOptions } = options
  const client = queryClient ?? createTestQueryClient()

  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <SessionProvider>
            {children}
          </SessionProvider>
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient: client }
}

// Simula uma sessao autenticada no sessionStorage
export function setFakeSession(role = 'admin') {
  sessionStorage.setItem('dte:token', 'fake-token-123')
  sessionStorage.setItem(
    'dte:user',
    JSON.stringify({ id: 'user-1', email: 'admin@dte.com', role, status: 'active' })
  )
}

export function clearFakeSession() {
  sessionStorage.removeItem('dte:token')
  sessionStorage.removeItem('dte:user')
}
