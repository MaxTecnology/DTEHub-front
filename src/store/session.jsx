import { createContext, useContext, useState } from 'react'

const SESSION_TOKEN_KEY = 'dte:token'
const SESSION_USER_KEY = 'dte:user'

const SessionContext = createContext(null)

function loadFromStorage() {
  try {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY)
    const user = JSON.parse(sessionStorage.getItem(SESSION_USER_KEY) || 'null')
    return { token, user }
  } catch {
    return { token: null, user: null }
  }
}

export function SessionProvider({ children }) {
  const stored = loadFromStorage()
  const [token, setToken] = useState(stored.token)
  const [user, setUser] = useState(stored.user)

  function login(accessToken, userData) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, accessToken)
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(userData))
    setToken(accessToken)
    setUser(userData)
  }

  function logout() {
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
    sessionStorage.removeItem(SESSION_USER_KEY)
    setToken(null)
    setUser(null)
  }

  const value = {
    token,
    user,
    role: user?.role ?? null,
    isAuthenticated: !!token,
    login,
    logout,
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession deve ser usado dentro de SessionProvider')
  }
  return context
}
