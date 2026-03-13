import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
})

// Injeta o Bearer token em todas as requisicoes
client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('dte:token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Trata erros de resposta globalmente
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status

    if (status === 401) {
      sessionStorage.removeItem('dte:token')
      sessionStorage.removeItem('dte:user')
      // Redireciona para login sem depender do router
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    if (status === 403) {
      error.forbidden = true
    }

    if (status === 502 || status === 503 || status === 504) {
      error.dteDown = true
    }

    return Promise.reject(error)
  }
)

export default client
