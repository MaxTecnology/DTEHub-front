import { AlertTriangle, XCircle, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function DteBanner({ status }) {
  if (status === 'UP' || !status) return null

  const isDegraded = status === 'DEGRADED'

  return (
    <Alert
      variant="destructive"
      className={isDegraded ? 'border-yellow-400 bg-yellow-50 text-yellow-900 [&>svg]:text-yellow-600' : ''}
      role="alert"
      data-testid="dte-banner"
    >
      {isDegraded ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      <AlertTitle>
        {isDegraded ? 'DTE com instabilidade' : 'DTE indisponível'}
      </AlertTitle>
      <AlertDescription>
        {isDegraded
          ? 'O portal DTE está apresentando lentidão ou falhas intermitentes. Dados em cache ainda estão disponíveis.'
          : 'O portal DTE está fora do ar. Sincronizações serão pausadas até a recuperação.'}
      </AlertDescription>
    </Alert>
  )
}

function formatDegradedDate(iso) {
  if (!iso) return null
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export function AuthDegradedBanner({ health }) {
  if (!health?.refreshDegraded) return null

  const until = formatDegradedDate(health.refreshDegradedUntil)

  return (
    <Alert
      className="border-orange-400 bg-orange-50 text-orange-900 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-300 [&>svg]:text-orange-600 dark:[&>svg]:text-orange-400"
      role="alert"
      data-testid="auth-degraded-banner"
    >
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>O refresh automático da DTE está com instabilidade</AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        {until && (
          <p>Nova tentativa automática após: <strong>{until}</strong></p>
        )}
        {health.refreshFailureCount != null && (
          <p>Falhas consecutivas: <strong>{health.refreshFailureCount}</strong></p>
        )}
        {health.refreshLastError && (
          <p className="font-mono text-xs mt-1 text-orange-800 dark:text-orange-400 break-all">
            {health.refreshLastError}
          </p>
        )}
        <p className="text-xs mt-1.5 text-orange-700 dark:text-orange-400">
          Isso afeta apenas o fluxo automático em background. A sessão DTE atual continua válida
          e admins podem realizar sincronização manual ou renovação de autenticação normalmente.
        </p>
      </AlertDescription>
    </Alert>
  )
}
