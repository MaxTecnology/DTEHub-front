import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getMessages } from '@/api/companies'
import { ReadStateBadge } from '@/components/ReadStateBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const READ_STATE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'nao_lida', label: 'Não lidas' },
  { value: 'lida', label: 'Lidas' },
  { value: 'desconhecida', label: 'Desconhecidas' },
]

const PAGE_SIZE = 20

function formatDate(val) {
  if (!val) return '—'
  // date-only "YYYY-MM-DD" — avoid UTC timezone offset shifting the day
  if (!val.includes('T')) {
    const [y, m, d] = val.split('-')
    return `${d}/${m}/${y}`
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(val))
}

export default function MessagesPage() {
  const { contratoId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const company = state?.company
  const [readStateFilter, setReadStateFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['messages', contratoId, page],
    queryFn: () => getMessages(contratoId, { page, pageSize: PAGE_SIZE }),
    staleTime: 30_000,
    enabled: !!contratoId,
  })

  const allMessages = data?.data ?? []
  const meta = data?.meta
  const totalPages = meta?.totalPages ?? 1

  const messages = readStateFilter
    ? allMessages.filter((m) => m.readState === readStateFilter)
    : allMessages

  function handleFilterChange(value) {
    setReadStateFilter(value)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/companies')}
          className="gap-1 w-fit -ml-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Empresas
        </Button>
        {company ? (
          <div>
            <h1 className="text-xl font-semibold">{company.descricao}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5">
              <span className="font-mono">{company.documento ? company.documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : '—'}</span>
              {company.inscricaoCompleta && <span>IE: {company.inscricaoCompleta}</span>}
              <span className="font-mono text-xs">Contrato {contratoId}</span>
            </p>
          </div>
        ) : (
          <h1 className="text-xl font-semibold">
            Mensagens — <span className="font-mono text-base text-muted-foreground">{contratoId}</span>
          </h1>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2" role="group" aria-label="Filtrar por estado">
        {READ_STATE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={readStateFilter === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange(opt.value)}
            data-testid={`filter-${opt.value || 'all'}`}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assunto</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Data</TableHead>
              <TableHead className="hidden md:table-cell">Docs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" data-testid="skeleton" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" data-testid="skeleton" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" data-testid="skeleton" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" data-testid="skeleton" /></TableCell>
                </TableRow>
              ))
            ) : messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhuma mensagem encontrada.
                </TableCell>
              </TableRow>
            ) : (
              messages.map((msg) => (
                <TableRow
                  key={msg.messageId}
                  data-testid="message-row"
                  data-read-state={msg.readState}
                  className={cn(
                    'cursor-pointer',
                    msg.readState === 'nao_lida'
                      ? 'bg-blue-50 hover:bg-blue-100 font-medium border-l-2 border-l-blue-500'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() =>
                    navigate(`/companies/${contratoId}/messages/${msg.messageId}`, { state: { company } })
                  }
                >
                  <TableCell>
                    <p className="leading-tight">{msg.assunto}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 sm:hidden">
                      <span>{formatDate(msg.messageDate)}</span>
                      <ReadStateBadge state={msg.readState} />
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <ReadStateBadge state={msg.readState} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {formatDate(msg.messageDate)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {msg.documentsCount ?? 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {meta?.page ?? page} de {totalPages}
            {meta?.totalItems ? ` · ${meta.totalItems} mensagens` : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              data-testid="prev-page-btn"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              data-testid="next-page-btn"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
