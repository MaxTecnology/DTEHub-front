import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Webhook,
  CheckCircle,
  XCircle,
  Clock,
  FlaskConical,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { getChannels, createChannel, testDelivery, getDeliveries } from '@/api/alerts'
import { useSession } from '@/store/session'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const ROLE_WEIGHT = { owner: 4, admin: 3, operator: 2, viewer: 1 }

const channelSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  endpointUrl: z.string().url({ message: 'URL inválida' }),
  webhookToken: z.string().min(1, 'Webhook token obrigatório'),
  hmacSecret: z.string().min(1, 'HMAC secret obrigatório'),
  enabled: z.boolean().default(true),
  timeoutMs: z.coerce.number().int().min(1000, 'Mínimo 1000ms').max(60000, 'Máximo 60000ms').default(10000),
  maxAttempts: z.coerce.number().int().min(1, 'Mínimo 1').max(20, 'Máximo 20').default(8),
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function SecretInput({ label, description, field }) {
  const [show, setShow] = useState(false)
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div className="relative">
          <Input
            type={show ? 'text' : 'password'}
            placeholder="••••••••••••••••"
            autoComplete="new-password"
            className="pr-10"
            {...field}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={show ? 'Ocultar' : 'Mostrar'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </FormControl>
      {description && <FormDescription className="text-xs">{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  )
}

function DeliveryStatusIcon({ status }) {
  if (status === 'sent') return <CheckCircle className="h-4 w-4 text-green-600" />
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-600" />
  return <Clock className="h-4 w-4 text-yellow-600" />
}

function deliveryStatusLabel(status) {
  const labels = { sent: 'Enviado', failed: 'Falhou', retrying: 'Tentando', pending: 'Pendente' }
  return labels[status] ?? status
}

function TestResultCard({ result }) {
  if (!result) return null
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-sm space-y-1',
        result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      )}
    >
      <div className="flex items-center gap-1.5 font-medium">
        {result.success ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
        {result.success ? 'Entrega realizada com sucesso' : 'Falha na entrega'}
      </div>
      {result.httpStatus && (
        <p className="text-muted-foreground">HTTP {result.httpStatus}</p>
      )}
      {result.errorMessage && (
        <p className="text-red-700 text-xs">{result.errorMessage}</p>
      )}
      {result.eventId && (
        <p className="text-xs text-muted-foreground font-mono">Event: {result.eventId}</p>
      )}
      {result.outboxId && (
        <p className="text-xs text-muted-foreground font-mono">Outbox: {result.outboxId}</p>
      )}
    </div>
  )
}

export default function AlertsPage() {
  const { role } = useSession()
  const queryClient = useQueryClient()
  const canManage = (ROLE_WEIGHT[role] ?? 0) >= ROLE_WEIGHT.admin
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testResults, setTestResults] = useState({}) // { [channelId]: result }
  const [deliveryFilter, setDeliveryFilter] = useState('')

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['alert-channels'],
    queryFn: getChannels,
  })

  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['alert-deliveries', deliveryFilter],
    queryFn: () => getDeliveries(deliveryFilter ? { channelId: deliveryFilter } : {}),
  })

  const deliveries = deliveriesData?.data ?? []

  const form = useForm({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      name: '',
      endpointUrl: '',
      webhookToken: '',
      hmacSecret: '',
      enabled: true,
      timeoutMs: 10000,
      maxAttempts: 8,
    },
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      createChannel({
        name: values.name,
        endpointUrl: values.endpointUrl,
        secret: values.hmacSecret,
        enabled: values.enabled,
        headersJson: {
          'x-webhook-token': values.webhookToken,
          'X-Source': 'dte-api',
        },
        timeoutMs: values.timeoutMs,
        maxAttempts: values.maxAttempts,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-channels'] })
      setDialogOpen(false)
      form.reset()
      toast.success('Canal criado com sucesso')
    },
    onError: () => toast.error('Falha ao criar canal'),
  })

  const testMutation = useMutation({
    mutationFn: (channelId) =>
      testDelivery({
        channelId,
        eventType: 'new_unread',
        companyName: 'DTE TEST COMPANY',
        assunto: 'Teste manual de alerta via n8n',
      }),
    onSuccess: (result, channelId) => {
      setTestResults((prev) => ({ ...prev, [channelId]: result }))
      queryClient.invalidateQueries({ queryKey: ['alert-deliveries'] })
      if (result?.success) {
        toast.success('Teste enviado com sucesso')
      } else {
        toast.error('Teste falhou — verifique o resultado abaixo')
      }
    },
    onError: (_, channelId) => {
      setTestResults((prev) => ({
        ...prev,
        [channelId]: { success: false, errorMessage: 'Erro ao contactar a API' },
      }))
      toast.error('Erro ao disparar teste')
    },
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-xl font-semibold">Alertas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configuração de canais webhook para notificações via n8n
        </p>
      </div>

      <Tabs defaultValue="channels">
        <TabsList className="mb-4">
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="history">Histórico de entregas</TabsTrigger>
        </TabsList>

        {/* ── ABA CANAIS ── */}
        <TabsContent value="channels" className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="add-channel-btn">
                <Plus className="h-4 w-4 mr-1.5" />
                Novo canal
              </Button>
            </div>
          )}

          {channelsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" data-testid="skeleton" />
              <Skeleton className="h-24 w-full" data-testid="skeleton" />
            </div>
          ) : channels.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid="no-channels-message">
                Nenhum canal configurado.
                {canManage && (
                  <p className="mt-1">Clique em "Novo canal" para adicionar um webhook n8n.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                canManage={canManage}
                isTesting={testMutation.isPending && testMutation.variables === channel.id}
                testResult={testResults[channel.id]}
                onTest={() => testMutation.mutate(channel.id)}
              />
            ))
          )}
        </TabsContent>

        {/* ── ABA HISTÓRICO ── */}
        <TabsContent value="history" className="space-y-4">
          {/* Filtro por canal */}
          {channels.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Filtrar por canal:</span>
              <Button
                size="sm"
                variant={deliveryFilter === '' ? 'default' : 'outline'}
                onClick={() => setDeliveryFilter('')}
              >
                Todos
              </Button>
              {channels.map((ch) => (
                <Button
                  key={ch.id}
                  size="sm"
                  variant={deliveryFilter === ch.id ? 'default' : 'outline'}
                  onClick={() => setDeliveryFilter(ch.id)}
                >
                  {ch.name}
                </Button>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="pt-4 space-y-2">
              {deliveriesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" data-testid="skeleton" />
                  <Skeleton className="h-10 w-full" data-testid="skeleton" />
                  <Skeleton className="h-10 w-full" data-testid="skeleton" />
                </div>
              ) : deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center" data-testid="no-deliveries-message">
                  Nenhuma entrega registrada.
                </p>
              ) : (
                deliveries.map((delivery, idx) => (
                  <div key={delivery.id ?? idx}>
                    {idx > 0 && <Separator className="my-2" />}
                    <div
                      className="flex items-start justify-between gap-4"
                      data-testid="delivery-row"
                    >
                      <div className="flex items-start gap-2">
                        <DeliveryStatusIcon status={delivery.status} />
                        <div>
                          <p className="text-sm font-medium">
                            {delivery.channelName ?? delivery.channelId ?? '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(delivery.sentAt ?? delivery.createdAt)}
                            {delivery.httpStatus && (
                              <span className="ml-2">HTTP {delivery.httpStatus}</span>
                            )}
                          </p>
                          {delivery.errorMessage && (
                            <p className="text-xs text-red-600 mt-0.5">{delivery.errorMessage}</p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={delivery.status === 'failed' ? 'destructive' : 'outline'}
                        data-testid="delivery-status-badge"
                      >
                        {deliveryStatusLabel(delivery.status)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── DIALOG: criar canal ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) form.reset() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo canal de notificação</DialogTitle>
            <DialogDescription>
              Configure um webhook n8n para receber alertas do DTE.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              O <strong>Webhook Token</strong> e o <strong>HMAC Secret</strong> são armazenados com
              segurança e <strong>não serão exibidos</strong> após o cadastro. Guarde-os em local
              seguro.
            </span>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutateAsync(v))} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do canal</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: n8n-dte-producao" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endpointUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do webhook n8n</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://flows.exemplo.com/webhook/dte-alerts"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      URL de produção do node Webhook no n8n
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="webhookToken"
                render={({ field }) => (
                  <SecretInput
                    label="Webhook Token"
                    description="Valor do header x-webhook-token esperado pelo n8n. Campo write-only."
                    field={field}
                  />
                )}
              />

              <FormField
                control={form.control}
                name="hmacSecret"
                render={({ field }) => (
                  <SecretInput
                    label="HMAC Secret"
                    description="Chave usada para assinar o payload (x-dte-signature). Campo write-only."
                    field={field}
                  />
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="timeoutMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout (ms)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1000} max={60000} step={1000} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxAttempts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máx. tentativas</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={20} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border px-3 py-2.5">
                    <div>
                      <FormLabel className="text-sm">Canal ativo</FormLabel>
                      <FormDescription className="text-xs">
                        Desative para pausar notificações sem excluir o canal
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="submit-channel-btn">
                  {createMutation.isPending ? 'Salvando...' : 'Salvar canal'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChannelCard({ channel, canManage, isTesting, testResult, onTest }) {
  const headers = channel.headersJson ?? {}
  const headerEntries = Object.entries(headers)

  return (
    <Card data-testid="channel-row">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-sm font-medium">{channel.name}</CardTitle>
          </div>
          <Badge
            variant={channel.enabled ? 'outline' : 'secondary'}
            className={channel.enabled ? 'border-green-300 text-green-700' : ''}
            data-testid="channel-status-badge"
          >
            {channel.enabled ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <CardDescription className="text-xs font-mono truncate pl-6">
          {channel.endpointUrl}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Headers (pode vir mascarado) */}
        {headerEntries.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Headers configurados
            </p>
            {headerEntries.map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted-foreground">{key}:</span>
                <span className={val === '[REDACTED]' ? 'text-amber-600 italic' : ''}>
                  {val}
                </span>
                {val === '[REDACTED]' && (
                  <span className="text-amber-600 text-[10px]">(valor sensível mascarado)</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {channel.timeoutMs && <span>Timeout: {channel.timeoutMs}ms</span>}
          {channel.maxAttempts && <span>Tentativas: {channel.maxAttempts}</span>}
        </div>

        {/* Teste de entrega */}
        {canManage && (
          <div className="space-y-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={isTesting}
              onClick={onTest}
              data-testid="test-channel-btn"
            >
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              {isTesting ? 'Enviando teste...' : 'Testar canal'}
            </Button>
            <TestResultCard result={testResult} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
