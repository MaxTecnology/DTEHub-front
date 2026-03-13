import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  UP:       { label: 'Operacional',  className: 'bg-green-100 text-green-800 border-green-200' },
  DEGRADED: { label: 'Degradado',    className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  DOWN:     { label: 'Indisponível', className: 'bg-red-100 text-red-800 border-red-200' },
}

export function DteStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? { label: status ?? '—', className: '' }

  return (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className)}
      data-testid="dte-status-badge"
      data-status={status}
    >
      {config.label}
    </Badge>
  )
}
