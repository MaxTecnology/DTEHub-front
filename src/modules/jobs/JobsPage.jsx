import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  FlaskConical,
} from 'lucide-react'
import { toast } from 'sonner'
import { startSync } from '@/api/ops'
import { getJob, getJobs, getActiveSync } from '@/api/jobs'
import { useSession } from '@/store/session'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ROLE_WEIGHT = { owner: 4, admin: 3, operator: 2, viewer: 1 }
const TERMINAL = ['success', 'failed']

const STATUS_CONFIG = {
  success: {
    label: 'Concluído',
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    badgeClass:
      'border-green-300 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-400',
  },
  failed: {
    label: 'Falhou',
    icon: XCircle,
    iconClass: 'text-red-600',
    variant: 'destructive',
    badgeClass: '',
  },
  running: {
    label: 'Executando',
    icon: Loader2,
    iconClass: 'text-blue-600 animate-spin',
    badgeClass: 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-400',
  },
  pending: {
    label: 'Aguardando',
    icon: Clock,
    iconClass: 'text-yellow-600',
    badgeClass:
      'border-yellow-300 text-yellow-700 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400',
  },
}

function formatDateTime(val) {
  if (!val) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(val))
}

function calcDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return '—'
  const s = Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return <Badge variant="outline">{status}</Badge>
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant ?? 'outline'} className={`gap-1.5 ${cfg.badgeClass}`}>
      <Icon className={`h-3.5 w-3.5 ${cfg.iconClass}`} />
      {cfg.label}
    </Badge>
  )
}

function ResultSummary({ job }) {
  const { resultSummary, status, errorMessage } = job
  if (!resultSummary) return <span className="text-muted-foreground">—</span>

  if (resultSummary.mode === 'dry_run') {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <FlaskConical className="h-3 w-3" />
        Simulação
      </Badge>
    )
  }

  if (status === 'success' && resultSummary.ingestion) {
    const { messagesInserted, messagesUpdated, companiesProcessed, companiesWithErrors } =
      resultSummary.ingestion
    return (
      <span className="text-xs text-muted-foreground">
        {companiesProcessed} emp · {messagesInserted} novas · {messagesUpdated} atualiz.
        {companiesWithErrors > 0 && (
          <span className="text-red-600 ml-1">· {companiesWithErrors} erros</span>
        )}
      </span>
    )
  }

  if (status === 'failed' && errorMessage) {
    return (
      <span className="text-xs text-red-600 truncate max-w-[220px] block" title={errorMessage}>
        {errorMessage}
      </span>
    )
  }

  return <span className="text-muted-foreground">—</span>
}

function TrackedJobDetail({ job }) {
  if (!TERMINAL.includes(job.status)) {
    return (
      <div className="flex items-center gap-2 text-blue-600" data-testid="job-running-indicator">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Aguardando conclusão...</span>
      </div>
    )
  }

  if (job.status === 'failed') {
    return (
      <div
        className="rounded-md bg-red-50 border border-red-200 p-3 dark:bg-red-950 dark:border-red-900"
        data-testid="job-error"
      >
        <p className="text-red-700 font-medium dark:text-red-400">Erro na sincronização</p>
        {job.errorMessage && (
          <p className="text-red-600 mt-1 dark:text-red-500">{job.errorMessage}</p>
        )}
      </div>
    )
  }

  if (job.status === 'success' && job.resultSummary) {
    const { mode, ingestion } = job.resultSummary
    if (mode === 'dry_run') {
      return (
        <div className="rounded-md bg-muted border p-3" data-testid="job-result">
          <p className="font-medium">Simulação executada — nenhuma alteração foi feita.</p>
        </div>
      )
    }
    return (
      <div
        className="rounded-md bg-green-50 border border-green-200 p-3 space-y-2 dark:bg-green-950 dark:border-green-900"
        data-testid="job-result"
      >
        <p className="text-green-700 font-medium dark:text-green-400">Sincronização concluída</p>
        {ingestion && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-green-700 dark:text-green-400 sm:grid-cols-4">
            <div>
              <span className="font-semibold">{ingestion.companiesProcessed}</span> empresas
            </div>
            <div>
              <span className="font-semibold">{ingestion.messagesInserted}</span> novas
            </div>
            <div>
              <span className="font-semibold">{ingestion.messagesUpdated}</span> atualizadas
            </div>
            {ingestion.companiesWithErrors > 0 && (
              <div className="text-red-600 dark:text-red-400">
                <span className="font-semibold">{ingestion.companiesWithErrors}</span> com erro
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return null
}

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { role } = useSession()
  const canSync = (ROLE_WEIGHT[role] ?? 0) >= ROLE_WEIGHT.operator

  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('active')
  const jobId = searchParams.get('jobId') || ''

  const FILTER_PARAMS = {
    active: { status: 'pending,running', jobType: 'sync_messages' },
    all: {},
    failed: { status: 'failed' },
  }

  function changeFilter(f) {
    setFilter(f)
    setPage(1)
  }

  // Polling do job em acompanhamento
  const { data: trackedJob, isLoading: trackedLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status || TERMINAL.includes(status)) return false
      return 2500
    },
    refetchIntervalInBackground: false,
  })

  // Jobs ativos — bloqueia disparo duplicado
  const { data: activeJobs = [] } = useQuery({
    queryKey: ['jobs-active-sync'],
    queryFn: getActiveSync,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
  const hasActiveSync = activeJobs.length > 0

  // Lista de jobs
  const { data: jobsResult, isLoading: listLoading } = useQuery({
    queryKey: ['jobs', page, filter],
    queryFn: () => getJobs({ page, pageSize: 15, ...FILTER_PARAMS[filter] }),
    refetchInterval: filter === 'active' || hasActiveSync ? 5000 : false,
  })
  const jobs = jobsResult?.data ?? []
  const meta = jobsResult?.meta

  const syncMutation = useMutation({
    mutationFn: () => startSync({ dryRun: false }),
    onSuccess: (data) => {
      const newJobId = data?.jobId
      if (newJobId) setSearchParams({ jobId: newJobId })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs-active-sync'] })
      toast.success('Sync iniciado')
    },
    onError: () => toast.error('Falha ao iniciar sync'),
  })

  const isTrackedRunning = !!jobId && !TERMINAL.includes(trackedJob?.status)
  const isSyncDisabled = syncMutation.isPending || hasActiveSync || isTrackedRunning

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs de Sync</h1>
        {canSync && (
          <div className="flex items-center gap-3">
            {hasActiveSync && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sync em andamento
              </span>
            )}
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={isSyncDisabled}
              size="sm"
              data-testid="new-sync-btn"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`}
              />
              Novo sync
            </Button>
          </div>
        )}
      </div>

      {/* Card do job em acompanhamento */}
      {jobId && (
        <Card
          data-testid="job-card"
          className={
            trackedJob?.status === 'failed'
              ? 'border-red-200'
              : trackedJob?.status === 'success'
                ? 'border-green-200'
                : 'border-blue-200'
          }
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                {trackedLoading ? (
                  <Skeleton className="h-5 w-40" />
                ) : (
                  <>
                    {trackedJob &&
                      (() => {
                        const cfg = STATUS_CONFIG[trackedJob.status]
                        if (!cfg) return null
                        const Icon = cfg.icon
                        return <Icon className={`h-5 w-5 ${cfg.iconClass}`} />
                      })()}
                    Job em acompanhamento
                  </>
                )}
              </CardTitle>
              {trackedJob && <StatusBadge status={trackedJob.status} />}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">{jobId}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {trackedLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" data-testid="skeleton" />
                <Skeleton className="h-4 w-64" data-testid="skeleton" />
              </div>
            ) : trackedJob ? (
              <TrackedJobDetail job={trackedJob} />
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Tabela de jobs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Jobs</CardTitle>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {[
                { key: 'active', label: 'Em andamento' },
                { key: 'failed', label: 'Falhou' },
                { key: 'all', label: 'Histórico' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => changeFilter(key)}
                  className={`px-3 py-1.5 transition-colors ${
                    filter === key
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {filter === 'active'
                ? 'Nenhum sync em execução no momento.'
                : filter === 'failed'
                  ? 'Nenhum job com falha encontrado.'
                  : 'Nenhum job encontrado.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Solicitado por</TableHead>
                  <TableHead>Iniciado em</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className={job.id === jobId ? 'bg-muted/40' : ''}
                    data-testid="job-row"
                  >
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell>
                      {job.payload?.dryRun ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <FlaskConical className="h-3 w-3" />
                          Simulação
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Live
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.requestedBy ?? 'Sistema'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(job.startedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {calcDuration(job.startedAt, job.finishedAt)}
                    </TableCell>
                    <TableCell>
                      <ResultSummary job={job} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t text-sm text-muted-foreground">
              <span>
                Página {meta.page} de {meta.totalPages} · {meta.totalItems} jobs
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= meta.totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
