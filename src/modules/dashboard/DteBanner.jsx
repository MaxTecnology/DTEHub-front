import { AlertTriangle, XCircle } from 'lucide-react'
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
