import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

// Radix Select usa pointer capture e scrollIntoView que nao existem em jsdom
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.setPointerCapture = () => {}
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

// Sonner usa window.matchMedia que nao existe em jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Inicia o servidor MSW antes de todos os testes
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reseta handlers customizados apos cada teste
afterEach(() => server.resetHandlers())

// Para o servidor apos todos os testes
afterAll(() => server.close())
