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
  PowerOff,
  Power,
  Trash2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getChannels,
  createChannel,
  testDelivery,
  getDeliveries,
  updateChannelStatus,
  deleteChannel,
} from '@/api/alerts'
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

function generateHexSecret(bytes) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

const channelSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  endpointUrl: z.string().min(1, 'URL obrigatória').refine((v) => { try { new URL(v); return true } catch { return false } }, { message: 'URL inválida' }),
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

function SecretInput({ label, field, onRegenerate, helpText }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!field.value) return
    await navigator.clipboard.writeText(field.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Input
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              className="pr-8 font-mono text-xs"
              {...field}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? 'Ocultar' : 'Mostrar'}
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onRegenerate}
            title="Regenerar valor"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleCopy}
            title={copied ? 'Copiado!' : 'Copiar'}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </FormControl>
      {helpText && (
        <FormDescription className="text-xs flex items-start gap-1 text-sky-700 dark:text-sky-400">
          <span className="shrink-0">→</span>
          <span>{helpText}</span>
        </FormDescription>
      )}
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

  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  function openCreateDialog() {
    form.reset({
      name: '',
      endpointUrl: '',
      webhookToken: generateHexSecret(16),
      hmacSecret: generateHexSecret(32),
      enabled: true,
      timeoutMs: 10000,
      maxAttempts: 8,
    })
    setCreateDialogOpen(true)
  }
  const [deleteTarget, setDeleteTarget] = useState(null) // channel object para confirmar exclusão
  const [testResults, setTestResults] = useState({})
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
      setCreateDialogOpen(false)
      form.reset()
      toast.success('Canal criado com sucesso')
    },
    onError: () => toast.error('Falha ao criar canal'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ channelId, enabled }) => updateChannelStatus(channelId, enabled),
    onSuccess: (result, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['alert-channels'] })
      if (!enabled) {
        const cancelled = result?.cancelledOutboxItems ?? 0
        toast.success(
          cancelled > 0
            ? `Canal desativado — ${cancelled} item(ns) da fila cancelado(s)`
            : 'Canal desativado'
        )
      } else {
        toast.success('Canal reativado')
      }
    },
    onError: (_, { enabled }) =>
      toast.error(enabled ? 'Falha ao reativar canal' : 'Falha ao desativar canal'),
  })

  const deleteMutation = useMutation({
    mutationFn: (channelId) => deleteChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-channels'] })
      setDeleteTarget(null)
      toast.success('Canal removido')
    },
    onError: (error) => {
      const status = error?.response?.status
      if (status === 409) {
        setDeleteTarget(null)
        toast.error(
          'Este canal possui histórico de entregas e não pode ser excluído. Desative-o para pausar as notificações.',
          { duration: 6000 }
        )
      } else {
        toast.error('Falha ao remover canal')
      }
    },
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
              <Button size="sm" onClick={openCreateDialog} data-testid="add-channel-btn">
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
                isTogglingStatus={statusMutation.isPending && statusMutation.variables?.channelId === channel.id}
                testResult={testResults[channel.id]}
                onTest={() => testMutation.mutate(channel.id)}
                onToggleStatus={(enabled) => statusMutation.mutate({ channelId: channel.id, enabled })}
                onRequestDelete={() => setDeleteTarget(channel)}
              />
            ))
          )}
        </TabsContent>

        {/* ── ABA HISTÓRICO ── */}
        <TabsContent value="history" className="space-y-4">
          {channels.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Filtrar:</span>
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
                    <div className="flex items-start justify-between gap-4" data-testid="delivery-row">
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
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => { if (!open) { setCreateDialogOpen(false); form.reset() } }}
      >
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
              segurança e <strong>não serão exibidos</strong> após o cadastro. Guarde-os em local seguro.
            </span>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createMutation.mutateAsync(v))}
              className="space-y-4"
              noValidate
            >
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
                    field={field}
                    onRegenerate={() => form.setValue('webhookToken', generateHexSecret(16), { shouldValidate: true })}
                    helpText="Use este valor no Header Auth do n8n com o nome x-webhook-token"
                  />
                )}
              />
              <FormField
                control={form.control}
                name="hmacSecret"
                render={({ field }) => (
                  <SecretInput
                    label="HMAC Secret"
                    field={field}
                    onRegenerate={() => form.setValue('hmacSecret', generateHexSecret(32), { shouldValidate: true })}
                    helpText="Use este valor no node de validação HMAC do n8n"
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
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="submit-channel-btn"
                >
                  {createMutation.isPending ? 'Salvando...' : 'Salvar canal'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: confirmar exclusão ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Remover canal
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o canal{' '}
              <strong>{deleteTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Canais com histórico de entregas <strong>não podem ser excluídos</strong>. Se este
              canal já enviou notificações, use <strong>Desativar</strong> para pausá-lo.
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              data-testid="confirm-delete-btn"
            >
              {deleteMutation.isPending ? 'Removendo...' : 'Confirmar remoção'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChannelCard({ channel, canManage, isTesting, isTogglingStatus, testResult, onTest, onToggleStatus, onRequestDelete }) {
  const isEnabled = channel.enabled
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
            variant={isEnabled ? 'outline' : 'secondary'}
            className={isEnabled ? 'border-green-300 text-green-700' : 'text-muted-foreground'}
            data-testid="channel-status-badge"
          >
            {isEnabled ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <CardDescription className="text-xs font-mono truncate pl-6">
          {channel.endpointUrl}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {headerEntries.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Headers configurados
            </p>
            {headerEntries.map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted-foreground">{key}:</span>
                <span className={val === '[REDACTED]' ? 'text-amber-600 italic' : ''}>{val}</span>
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

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Testar — só canal ativo */}
            {isEnabled && (
              <Button
                variant="outline"
                size="sm"
                disabled={isTesting || isTogglingStatus}
                onClick={onTest}
                data-testid="test-channel-btn"
              >
                <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
                {isTesting ? 'Enviando...' : 'Testar'}
              </Button>
            )}

            {/* Desativar / Reativar */}
            {isEnabled ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isTogglingStatus}
                onClick={() => onToggleStatus(false)}
                data-testid="disable-channel-btn"
              >
                <PowerOff className="h-3.5 w-3.5 mr-1.5" />
                {isTogglingStatus ? 'Desativando...' : 'Desativar'}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isTogglingStatus}
                  onClick={() => onToggleStatus(true)}
                  data-testid="enable-channel-btn"
                >
                  <Power className="h-3.5 w-3.5 mr-1.5" />
                  {isTogglingStatus ? 'Reativando...' : 'Reativar'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isTogglingStatus}
                  onClick={onRequestDelete}
                  data-testid="delete-channel-btn"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remover
                </Button>
              </>
            )}
          </div>
        )}

        <TestResultCard result={testResult} />
      </CardContent>
    </Card>
  )
}
