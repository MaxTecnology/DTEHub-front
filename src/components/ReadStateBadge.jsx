import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATE_CONFIG = {
  nao_lida:    { label: 'Não lida',    className: 'bg-blue-100 text-blue-800 border-blue-300 font-semibold' },
  lida:        { label: 'Lida',        className: 'bg-gray-100 text-gray-600 border-gray-200' },
  desconhecida:{ label: 'Desconhecida',className: 'bg-orange-50 text-orange-700 border-orange-200' },
}

export function ReadStateBadge({ state }) {
  const config = STATE_CONFIG[state] ?? { label: state ?? '—', className: '' }

  return (
    <Badge
      variant="outline"
      className={cn('text-xs', config.className)}
      data-testid="read-state-badge"
      data-state={state}
    >
      {config.label}
    </Badge>
  )
}
