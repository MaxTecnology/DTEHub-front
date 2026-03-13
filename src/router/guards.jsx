import { Navigate } from 'react-router-dom'
import { useSession } from '@/store/session'

// Redireciona para /login se nao autenticado
export function RequireAuth({ children }) {
  const { isAuthenticated } = useSession()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Exibe tela de acesso negado se role insuficiente
// roles: array de roles permitidas, ex: ['admin', 'owner']
export function RequireRole({ roles, children }) {
  const { role } = useSession()

  if (!roles.includes(role)) {
    return <AccessDenied requiredRoles={roles} currentRole={role} />
  }

  return children
}

function AccessDenied({ requiredRoles, currentRole }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-4xl">🔒</p>
      <h2 className="text-xl font-semibold">Acesso negado</h2>
      <p className="text-sm text-muted-foreground">
        Seu perfil <strong>{currentRole}</strong> não tem permissão para acessar esta página.
        <br />
        Necessário: <strong>{requiredRoles.join(' ou ')}</strong>.
      </p>
    </div>
  )
}
