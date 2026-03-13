import { useNavigate } from 'react-router-dom'
import { useSession } from '@/store/session'
import * as authApi from '@/api/auth'

export function useAuth() {
  const session = useSession()
  const navigate = useNavigate()

  async function signIn(email, password) {
    const data = await authApi.login(email, password)
    session.login(data.accessToken, data.user)
    navigate('/dashboard', { replace: true })
  }

  async function signOut() {
    try {
      await authApi.logout()
    } finally {
      session.logout()
      navigate('/login', { replace: true })
    }
  }

  return {
    user: session.user,
    role: session.role,
    isAuthenticated: session.isAuthenticated,
    signIn,
    signOut,
  }
}
