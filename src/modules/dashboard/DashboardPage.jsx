import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Building2, MailOpen, Clock, Activity } from 'lucide-react'
import { getHealthDte, getDashboard, startSync } from '@/api/ops'
import { useSession } from '@/store/session'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DteStatusBadge } from './DteStatusBadge'
import { DteBanner } from './DteBanner'

const ROLE_WEIGHT = { owner: 4, admin: 3, operator: 2, viewer: 1 }

function deriveStatus(health) {
  if (!health) return undefined
  if (health.pingStatus !== 200) return 'DOWN'
  if (!health.authenticated) return 'DEGRADED'
  return 'UP'
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function DashboardPage() {
  const { role } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canSync = (ROLE_WEIGHT[role] ?? 0) >= ROLE_WEIGHT.operator

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health-dte'],
    queryFn: getHealthDte,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  const syncMutation = useMutation({
    mutationFn: () => startSync({ dryRun: false }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/jobs?jobId=${data?.jobId ?? ''}`)
    },
  })

  const dteStatus = deriveStatus(health)
  const unread = dashboard?.messages?.unread ?? 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {canSync && (
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            size="sm"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', syncMutation.isPending && 'animate-spin')} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>
        )}
      </div>

      <DteBanner status={dteStatus} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status DTE */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status DTE
              </CardTitle>
              <div className="rounded-lg bg-slate-100 p-1.5">
                <Activity className="h-4 w-4 text-slate-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-6 w-24" data-testid="skeleton" />
            ) : (
              <DteStatusBadge status={dteStatus} />
            )}
          </CardContent>
        </Card>

        {/* Total Empresas */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Empresas
              </CardTitle>
              <div className="rounded-lg bg-sky-50 p-1.5">
                <Building2 className="h-4 w-4 text-sky-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dashLoading ? (
              <Skeleton className="h-8 w-12" data-testid="skeleton" />
            ) : (
              <p
                className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate('/companies')}
                data-testid="total-companies"
              >
                {dashboard?.companies?.total ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Nao lidas */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Não lidas
              </CardTitle>
              <div className={cn('rounded-lg p-1.5', unread > 0 ? 'bg-amber-50' : 'bg-slate-100')}>
                <MailOpen className={cn('h-4 w-4', unread > 0 ? 'text-amber-500' : 'text-slate-500')} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dashLoading ? (
              <Skeleton className="h-8 w-12" data-testid="skeleton" />
            ) : (
              <p
                className={cn(
                  'text-2xl font-bold cursor-pointer transition-colors',
                  unread > 0 ? 'text-amber-500 hover:text-amber-600' : 'hover:text-primary'
                )}
                onClick={() => navigate('/companies?onlyWithUnread=true')}
                data-testid="total-unread"
              >
                {unread}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Ultimo sync */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Último sync
              </CardTitle>
              <div className="rounded-lg bg-emerald-50 p-1.5">
                <Clock className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dashLoading ? (
              <Skeleton className="h-6 w-32" data-testid="skeleton" />
            ) : (
              <p className="text-sm font-medium" data-testid="last-sync">
                {formatDate(dashboard?.syncJobs?.lastSuccessAt)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
