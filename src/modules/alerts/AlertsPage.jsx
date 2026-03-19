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
  Pencil,
  Route,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getChannels, createChannel, testDelivery, getDeliveries,
  updateChannelStatus, deleteChannel,
  getRoutings, createRouting, updateRoutingStatus, deleteRouting,
  getRecipients, createRecipient, updateRecipient, updateRecipientStatus, deleteRecipient,
} from '@/api/alerts'
import { useSession } from '@/store/session'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel,
  FormMessage, FormDescription,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_WEIGHT = { owner: 4, admin: 3, operator: 2, viewer: 1 }

const EVENT_TYPE_OPTIONS = [
  { value: 'new_unread', label: 'Nova mensagem não lida' },
  { value: 'still_unread', label: 'Ainda não lida' },
  { value: 'marked_read', label: 'Marcada como lida' },
]

const PREFERRED_CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

function eventTypeLabel(v) {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v
}
function channelLabel(v) {
  return PREFERRED_CHANNEL_OPTIONS.find((o) => o.value === v)?.label ?? v
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

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
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(10000),
  maxAttempts: z.coerce.number().int().min(1).max(20).default(8),
})

const routingSchema = z.object({
  channelId: z.string().min(1, 'Canal obrigatório'),
  contratoId: z.string().optional(),
  eventTypes: z.array(z.string()).min(1, 'Selecione ao menos um tipo de evento'),
  dedupeWindowMinutes: z.coerce.number().int().min(1).max(1440).default(30),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
})

const recipientSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  preferredChannels: z.array(z.string()).min(1, 'Selecione ao menos um canal'),
  eventTypes: z.array(z.string()).min(1, 'Selecione ao menos um tipo de evento'),
  contratoId: z.string().optional(),
  enabled: z.boolean().default(true),
  notes: z.string().optional(),
}).refine((d) => !!(d.email || d.phoneNumber), {
  message: 'Email ou telefone são obrigatórios',
  path: ['email'],
}).refine((d) => !d.preferredChannels.includes('email') || !!d.email, {
  message: 'Email obrigatório quando canal Email está selecionado',
  path: ['email'],
}).refine((d) => !d.preferredChannels.includes('whatsapp') || !!d.phoneNumber, {
  message: 'Telefone obrigatório quando WhatsApp está selecionado',
  path: ['phoneNumber'],
})

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

function CopyButton({ value, title }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={handleCopy}
      title={copied ? 'Copiado!' : (title ?? 'Copiar')}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function ToggleSelect({ options, value = [], onChange, className }) {
  function toggle(opt) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt])
  }
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs border transition-colors',
            value.includes(opt.value)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-input bg-background hover:bg-muted'
          )}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function ScopeBadge({ contratoId, scopeType }) {
  const isGlobal = !contratoId && scopeType !== 'company'
  return (
    <Badge variant="outline" className={isGlobal ? 'border-green-300 text-green-700' : 'border-blue-300 text-blue-700'}>
      {isGlobal ? 'Global' : 'Por empresa'}
    </Badge>
  )
}

function StatusBadge({ enabled }) {
  return (
    <Badge variant={enabled ? 'outline' : 'secondary'}
      className={enabled ? 'border-green-300 text-green-700' : 'text-muted-foreground'}>
      {enabled ? 'Ativo' : 'Inativo'}
    </Badge>
  )
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
            <Input type={show ? 'text' : 'password'} autoComplete="new-password"
              className="pr-8 font-mono text-xs" {...field} />
            <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? 'Ocultar' : 'Mostrar'}>
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
            onClick={onRegenerate} title="Regenerar valor">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
            onClick={handleCopy} title={copied ? 'Copiado!' : 'Copiar'}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </FormControl>
      {helpText && (
        <FormDescription className="text-xs flex items-start gap-1 text-sky-700 dark:text-sky-400">
          <span className="shrink-0">→</span><span>{helpText}</span>
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
  return { sent: 'Enviado', failed: 'Falhou', retrying: 'Tentando', pending: 'Pendente' }[status] ?? status
}

function TestResultCard({ result }) {
  if (!result) return null
  return (
    <div className={cn('rounded-md border p-3 text-sm space-y-1',
      result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')}>
      <div className="flex items-center gap-1.5 font-medium">
        {result.success
          ? <CheckCircle className="h-4 w-4 text-green-600" />
          : <XCircle className="h-4 w-4 text-red-600" />}
        {result.success ? 'Entrega realizada com sucesso' : 'Falha na entrega'}
      </div>
      {result.httpStatus && <p className="text-muted-foreground">HTTP {result.httpStatus}</p>}
      {result.errorMessage && <p className="text-red-700 text-xs">{result.errorMessage}</p>}
      {result.eventId && <p className="text-xs text-muted-foreground font-mono">Event: {result.eventId}</p>}
      {result.outboxId && <p className="text-xs text-muted-foreground font-mono">Outbox: {result.outboxId}</p>}
    </div>
  )
}

function MetaRow({ label, value, copyTitle, hint }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-24 shrink-0">{label}:</span>
        <span className="truncate flex-1 text-foreground/80">{value}</span>
        {value && <CopyButton value={value} title={copyTitle} />}
      </div>
      {hint && <p className="text-[10px] text-sky-700 dark:text-sky-400 pl-24">→ {hint}</p>}
    </div>
  )
}

function DeleteConfirmDialog({ open, name, description, onCancel, onConfirm, isPending }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> Remover
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja remover <strong>{name}</strong>?
            {description && <span className="block mt-1 text-xs">{description}</span>}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}
            data-testid="confirm-delete-btn">
            {isPending ? 'Removendo...' : 'Confirmar remoção'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { role } = useSession()
  const queryClient = useQueryClient()
  const canManage = (ROLE_WEIGHT[role] ?? 0) >= ROLE_WEIGHT.admin

  // ── Channel state ──
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [deleteChannelTarget, setDeleteChannelTarget] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [deliveryFilter, setDeliveryFilter] = useState('')

  // ── Routing state ──
  const [createRoutingOpen, setCreateRoutingOpen] = useState(false)
  const [deleteRoutingTarget, setDeleteRoutingTarget] = useState(null)

  // ── Recipient state ──
  const [recipientDialogTarget, setRecipientDialogTarget] = useState(null) // null=closed, {} = create, obj = edit
  const [deleteRecipientTarget, setDeleteRecipientTarget] = useState(null)

  // ── Queries ──
  const { data: channels = [], isLoading: channelsLoading } = useQuery({ queryKey: ['alert-channels'], queryFn: getChannels })
  const { data: routings = [], isLoading: routingsLoading } = useQuery({ queryKey: ['alert-routings'], queryFn: getRoutings })
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({ queryKey: ['alert-recipients'], queryFn: getRecipients })
  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['alert-deliveries', deliveryFilter],
    queryFn: () => getDeliveries(deliveryFilter ? { channelId: deliveryFilter } : {}),
  })
  const deliveries = deliveriesData?.data ?? []

  // ── Forms ──
  const channelForm = useForm({ resolver: zodResolver(channelSchema), defaultValues: { name: '', endpointUrl: '', webhookToken: '', hmacSecret: '', enabled: true, timeoutMs: 10000, maxAttempts: 8 } })
  const routingForm = useForm({ resolver: zodResolver(routingSchema), defaultValues: { channelId: '', contratoId: '', eventTypes: ['new_unread', 'still_unread'], dedupeWindowMinutes: 30, enabled: true, description: '' } })
  const recipientForm = useForm({ resolver: zodResolver(recipientSchema), defaultValues: { name: '', email: '', phoneNumber: '', preferredChannels: ['email'], eventTypes: ['new_unread', 'still_unread'], contratoId: '', enabled: true, notes: '' } })

  function openCreateChannel() {
    channelForm.reset({ name: '', endpointUrl: '', webhookToken: generateHexSecret(16), hmacSecret: generateHexSecret(32), enabled: true, timeoutMs: 10000, maxAttempts: 8 })
    setCreateChannelOpen(true)
  }

  function openCreateRouting() {
    routingForm.reset({ channelId: '', contratoId: '', eventTypes: ['new_unread', 'still_unread'], dedupeWindowMinutes: 30, enabled: true, description: '' })
    setCreateRoutingOpen(true)
  }

  function openCreateRecipient() {
    recipientForm.reset({ name: '', email: '', phoneNumber: '', preferredChannels: ['email'], eventTypes: ['new_unread', 'still_unread'], contratoId: '', enabled: true, notes: '' })
    setRecipientDialogTarget({})
  }

  function openEditRecipient(recipient) {
    recipientForm.reset({
      name: recipient.name ?? '',
      email: recipient.email ?? '',
      phoneNumber: recipient.phoneNumber ?? '',
      preferredChannels: recipient.preferredChannels ?? ['email'],
      eventTypes: recipient.eventTypes ?? [],
      contratoId: recipient.contratoId ? String(recipient.contratoId) : '',
      enabled: recipient.enabled ?? true,
      notes: recipient.notes ?? '',
    })
    setRecipientDialogTarget(recipient)
  }

  // ── Channel mutations ──
  const createChannelMutation = useMutation({
    mutationFn: (v) => createChannel({ name: v.name, endpointUrl: v.endpointUrl, secret: v.hmacSecret, enabled: v.enabled, headersJson: { 'x-webhook-token': v.webhookToken, 'X-Source': 'dte-api' }, timeoutMs: v.timeoutMs, maxAttempts: v.maxAttempts }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alert-channels'] }); setCreateChannelOpen(false); channelForm.reset(); toast.success('Canal criado com sucesso') },
    onError: () => toast.error('Falha ao criar canal'),
  })

  const channelStatusMutation = useMutation({
    mutationFn: ({ channelId, enabled }) => updateChannelStatus(channelId, enabled),
    onSuccess: (result, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['alert-channels'] })
      if (!enabled) { const c = result?.cancelledOutboxItems ?? 0; toast.success(c > 0 ? `Canal desativado — ${c} item(ns) cancelado(s)` : 'Canal desativado') }
      else toast.success('Canal reativado')
    },
    onError: (_, { enabled }) => toast.error(enabled ? 'Falha ao reativar canal' : 'Falha ao desativar canal'),
  })

  const deleteChannelMutation = useMutation({
    mutationFn: (id) => deleteChannel(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['alert-channels'] })
      setDeleteChannelTarget(null)
      toast.success(result?.action === 'archived' ? 'Canal arquivado e removido da listagem.' : 'Canal removido com sucesso.')
    },
    onError: () => toast.error('Falha ao remover canal'),
  })

  const testMutation = useMutation({
    mutationFn: (channelId) => testDelivery({ channelId, eventType: 'new_unread', companyName: 'DTE TEST COMPANY', assunto: 'Teste manual de alerta via n8n' }),
    onSuccess: (result, channelId) => {
      setTestResults((prev) => ({ ...prev, [channelId]: result }))
      queryClient.invalidateQueries({ queryKey: ['alert-deliveries'] })
      result?.success ? toast.success('Teste enviado com sucesso') : toast.error('Teste falhou — verifique o resultado abaixo')
    },
    onError: (_, channelId) => { setTestResults((p) => ({ ...p, [channelId]: { success: false, errorMessage: 'Erro ao contactar a API' } })); toast.error('Erro ao disparar teste') },
  })

  // ── Routing mutations ──
  const createRoutingMutation = useMutation({
    mutationFn: (v) => createRouting({
      channelId: v.channelId,
      eventTypes: v.eventTypes,
      dedupeWindowMinutes: v.dedupeWindowMinutes,
      enabled: v.enabled,
      ...(v.contratoId ? { contratoId: Number(v.contratoId) } : {}),
      ...(v.description ? { description: v.description } : {}),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alert-routings'] }); setCreateRoutingOpen(false); toast.success('Roteamento criado') },
    onError: () => toast.error('Falha ao criar roteamento'),
  })

  const routingStatusMutation = useMutation({
    mutationFn: ({ routingId, enabled }) => updateRoutingStatus(routingId, enabled),
    onSuccess: (_, { enabled }) => { queryClient.invalidateQueries({ queryKey: ['alert-routings'] }); toast.success(enabled ? 'Roteamento ativado' : 'Roteamento desativado') },
    onError: (_, { enabled }) => toast.error(enabled ? 'Falha ao ativar' : 'Falha ao desativar'),
  })

  const deleteRoutingMutation = useMutation({
    mutationFn: (id) => deleteRouting(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alert-routings'] }); setDeleteRoutingTarget(null); toast.success('Roteamento removido') },
    onError: () => toast.error('Falha ao remover roteamento'),
  })

  // ── Recipient mutations ──
  const saveRecipientMutation = useMutation({
    mutationFn: (v) => {
      const payload = {
        name: v.name,
        preferredChannels: v.preferredChannels,
        eventTypes: v.eventTypes,
        enabled: v.enabled,
        ...(v.email ? { email: v.email } : {}),
        ...(v.phoneNumber ? { phoneNumber: v.phoneNumber } : {}),
        ...(v.contratoId ? { contratoId: Number(v.contratoId) } : {}),
        ...(v.notes ? { notes: v.notes } : {}),
      }
      if (recipientDialogTarget?.id) return updateRecipient(recipientDialogTarget.id, payload)
      return createRecipient(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-recipients'] })
      const isEdit = !!recipientDialogTarget?.id
      setRecipientDialogTarget(null)
      toast.success(isEdit ? 'Destinatário atualizado' : 'Destinatário criado')
    },
    onError: () => toast.error('Falha ao salvar destinatário'),
  })

  const recipientStatusMutation = useMutation({
    mutationFn: ({ recipientId, enabled }) => updateRecipientStatus(recipientId, enabled),
    onSuccess: (_, { enabled }) => { queryClient.invalidateQueries({ queryKey: ['alert-recipients'] }); toast.success(enabled ? 'Destinatário ativado' : 'Destinatário desativado') },
    onError: () => toast.error('Falha ao atualizar status'),
  })

  const deleteRecipientMutation = useMutation({
    mutationFn: (id) => deleteRecipient(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alert-recipients'] }); setDeleteRecipientTarget(null); toast.success('Destinatário removido') },
    onError: () => toast.error('Falha ao remover destinatário'),
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-xl font-semibold">Alertas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie canais, roteamentos e destinatários de notificação via n8n
        </p>
      </div>

      {/* Contexto do fluxo */}
      <div className="rounded-md border border-sky-200 bg-sky-50 dark:bg-sky-950/20 dark:border-sky-800 px-3 py-2.5 text-xs text-sky-800 dark:text-sky-300 space-y-0.5">
        <p><strong>Canais</strong> — para onde a API envia (URL do webhook n8n)</p>
        <p><strong>Roteamentos</strong> — quando e para qual escopo disparar alertas</p>
        <p><strong>Destinatários</strong> — quem deve receber dentro do workflow n8n via <code>payload.recipients</code></p>
      </div>

      <Tabs defaultValue="channels">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="channels" className="flex items-center gap-1.5">
            <Webhook className="h-3.5 w-3.5" /> Canais
          </TabsTrigger>
          <TabsTrigger value="routings" className="flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5" /> Roteamentos
          </TabsTrigger>
          <TabsTrigger value="recipients" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Destinatários
          </TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* ══ ABA CANAIS ══ */}
        <TabsContent value="channels" className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreateChannel} data-testid="add-channel-btn">
                <Plus className="h-4 w-4 mr-1.5" /> Novo canal
              </Button>
            </div>
          )}
          {channelsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" data-testid="skeleton" />
              <Skeleton className="h-28 w-full" data-testid="skeleton" />
            </div>
          ) : channels.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid="no-channels-message">
              Nenhum canal configurado.{canManage && <p className="mt-1">Clique em "Novo canal" para adicionar um webhook n8n.</p>}
            </CardContent></Card>
          ) : channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} canManage={canManage}
              isTesting={testMutation.isPending && testMutation.variables === channel.id}
              isTogglingStatus={channelStatusMutation.isPending && channelStatusMutation.variables?.channelId === channel.id}
              testResult={testResults[channel.id]}
              onTest={() => testMutation.mutate(channel.id)}
              onToggleStatus={(enabled) => channelStatusMutation.mutate({ channelId: channel.id, enabled })}
              onRequestDelete={() => setDeleteChannelTarget(channel)} />
          ))}
        </TabsContent>

        {/* ══ ABA ROTEAMENTOS ══ */}
        <TabsContent value="routings" className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreateRouting} data-testid="add-routing-btn">
                <Plus className="h-4 w-4 mr-1.5" /> Novo roteamento
              </Button>
            </div>
          )}
          {routingsLoading ? (
            <div className="space-y-3"><Skeleton className="h-24 w-full" data-testid="skeleton" /><Skeleton className="h-24 w-full" data-testid="skeleton" /></div>
          ) : routings.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid="no-routings-message">
              Nenhum roteamento configurado.{canManage && <p className="mt-1">Clique em "Novo roteamento" para definir quando os alertas devem ser disparados.</p>}
            </CardContent></Card>
          ) : routings.map((routing) => (
            <RoutingCard key={routing.id} routing={routing} canManage={canManage}
              isToggling={routingStatusMutation.isPending && routingStatusMutation.variables?.routingId === routing.id}
              onToggleStatus={(enabled) => routingStatusMutation.mutate({ routingId: routing.id, enabled })}
              onRequestDelete={() => setDeleteRoutingTarget(routing)} />
          ))}
        </TabsContent>

        {/* ══ ABA DESTINATÁRIOS ══ */}
        <TabsContent value="recipients" className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreateRecipient} data-testid="add-recipient-btn">
                <Plus className="h-4 w-4 mr-1.5" /> Novo destinatário
              </Button>
            </div>
          )}
          {recipientsLoading ? (
            <div className="space-y-3"><Skeleton className="h-24 w-full" data-testid="skeleton" /><Skeleton className="h-24 w-full" data-testid="skeleton" /></div>
          ) : recipients.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground" data-testid="no-recipients-message">
              Nenhum destinatário configurado.{canManage && <p className="mt-1">Destinatários recebem o campo <code>payload.recipients</code> no n8n.</p>}
            </CardContent></Card>
          ) : recipients.map((recipient) => (
            <RecipientCard key={recipient.id} recipient={recipient} canManage={canManage}
              isToggling={recipientStatusMutation.isPending && recipientStatusMutation.variables?.recipientId === recipient.id}
              onToggleStatus={(enabled) => recipientStatusMutation.mutate({ recipientId: recipient.id, enabled })}
              onEdit={() => openEditRecipient(recipient)}
              onRequestDelete={() => setDeleteRecipientTarget(recipient)} />
          ))}
        </TabsContent>

        {/* ══ ABA HISTÓRICO ══ */}
        <TabsContent value="history" className="space-y-4">
          {channels.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Filtrar:</span>
              <Button size="sm" variant={deliveryFilter === '' ? 'default' : 'outline'} onClick={() => setDeliveryFilter('')}>Todos</Button>
              {channels.map((ch) => (
                <Button key={ch.id} size="sm" variant={deliveryFilter === ch.id ? 'default' : 'outline'} onClick={() => setDeliveryFilter(ch.id)}>{ch.name}</Button>
              ))}
            </div>
          )}
          <Card>
            <CardContent className="pt-4 space-y-2">
              {deliveriesLoading ? (
                <div className="space-y-2"><Skeleton className="h-10 w-full" data-testid="skeleton" /><Skeleton className="h-10 w-full" data-testid="skeleton" /></div>
              ) : deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center" data-testid="no-deliveries-message">Nenhuma entrega registrada.</p>
              ) : deliveries.map((delivery, idx) => (
                <div key={delivery.id ?? idx}>
                  {idx > 0 && <Separator className="my-2" />}
                  <div className="flex items-start justify-between gap-4" data-testid="delivery-row">
                    <div className="flex items-start gap-2">
                      <DeliveryStatusIcon status={delivery.status} />
                      <div>
                        <p className="text-sm font-medium">{delivery.channelName ?? delivery.channelId ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(delivery.sentAt ?? delivery.createdAt)}
                          {delivery.httpStatus && <span className="ml-2">HTTP {delivery.httpStatus}</span>}
                        </p>
                        {delivery.errorMessage && <p className="text-xs text-red-600 mt-0.5">{delivery.errorMessage}</p>}
                      </div>
                    </div>
                    <Badge variant={delivery.status === 'failed' ? 'destructive' : 'outline'} data-testid="delivery-status-badge">
                      {deliveryStatusLabel(delivery.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ══ DIALOG: criar canal ══ */}
      <Dialog open={createChannelOpen} onOpenChange={(o) => { if (!o) { setCreateChannelOpen(false); channelForm.reset() } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo canal de notificação</DialogTitle>
            <DialogDescription>Configure um webhook n8n para receber alertas do DTE.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>O <strong>Webhook Token</strong> e o <strong>HMAC Secret</strong> não serão exibidos após o cadastro. Guarde-os em local seguro.</span>
          </div>
          <Form {...channelForm}>
            <form onSubmit={channelForm.handleSubmit((v) => createChannelMutation.mutateAsync(v))} className="space-y-4" noValidate>
              <FormField control={channelForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome do canal</FormLabel><FormControl><Input placeholder="Ex: n8n-dte-producao" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={channelForm.control} name="endpointUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do webhook n8n</FormLabel>
                  <FormControl><Input type="url" placeholder="https://flows.exemplo.com/webhook/dte-alerts" {...field} /></FormControl>
                  <FormDescription className="text-xs">URL de produção do node Webhook no n8n</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={channelForm.control} name="webhookToken" render={({ field }) => (
                <SecretInput label="Webhook Token" field={field}
                  onRegenerate={() => channelForm.setValue('webhookToken', generateHexSecret(16), { shouldValidate: true })}
                  helpText="Use este valor no Header Auth do n8n com o nome x-webhook-token" />
              )} />
              <FormField control={channelForm.control} name="hmacSecret" render={({ field }) => (
                <SecretInput label="HMAC Secret" field={field}
                  onRegenerate={() => channelForm.setValue('hmacSecret', generateHexSecret(32), { shouldValidate: true })}
                  helpText="Use este valor no node de validação HMAC do n8n" />
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={channelForm.control} name="timeoutMs" render={({ field }) => (
                  <FormItem><FormLabel>Timeout (ms)</FormLabel><FormControl><Input type="number" min={1000} max={60000} step={1000} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={channelForm.control} name="maxAttempts" render={({ field }) => (
                  <FormItem><FormLabel>Máx. tentativas</FormLabel><FormControl><Input type="number" min={1} max={20} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={channelForm.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border px-3 py-2.5">
                  <div><FormLabel className="text-sm">Canal ativo</FormLabel><FormDescription className="text-xs">Desative para pausar sem excluir</FormDescription></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateChannelOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createChannelMutation.isPending} data-testid="submit-channel-btn">
                  {createChannelMutation.isPending ? 'Salvando...' : 'Salvar canal'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: confirmar exclusão canal ══ */}
      <DeleteConfirmDialog
        open={!!deleteChannelTarget} name={deleteChannelTarget?.name}
        description="Se o canal possuir histórico de entregas, será arquivado em vez de excluído."
        onCancel={() => setDeleteChannelTarget(null)}
        onConfirm={() => deleteChannelMutation.mutate(deleteChannelTarget.id)}
        isPending={deleteChannelMutation.isPending} />

      {/* ══ DIALOG: criar roteamento ══ */}
      <Dialog open={createRoutingOpen} onOpenChange={(o) => { if (!o) { setCreateRoutingOpen(false); routingForm.reset() } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo roteamento de alerta</DialogTitle>
            <DialogDescription>Define quando e para qual escopo os alertas devem ser disparados.</DialogDescription>
          </DialogHeader>
          <Form {...routingForm}>
            <form onSubmit={routingForm.handleSubmit((v) => createRoutingMutation.mutateAsync(v))} className="space-y-4" noValidate>
              <FormField control={routingForm.control} name="channelId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Canal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione um canal" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {channels.map((ch) => <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={routingForm.control} name="contratoId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contrato ID <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl><Input placeholder="Deixe vazio para roteamento global" {...field} /></FormControl>
                  <FormDescription className="text-xs">Se preenchido, o alerta só dispara para esta empresa</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={routingForm.control} name="eventTypes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipos de evento</FormLabel>
                  <FormControl>
                    <ToggleSelect options={EVENT_TYPE_OPTIONS} value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={routingForm.control} name="dedupeWindowMinutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Janela de deduplicação (minutos)</FormLabel>
                  <FormControl><Input type="number" min={1} max={1440} {...field} /></FormControl>
                  <FormDescription className="text-xs">Evita alertas duplicados dentro deste intervalo</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={routingForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl><Input placeholder="Ex: Alertas da empresa 347215" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={routingForm.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border px-3 py-2.5">
                  <div><FormLabel className="text-sm">Ativo</FormLabel></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateRoutingOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createRoutingMutation.isPending} data-testid="submit-routing-btn">
                  {createRoutingMutation.isPending ? 'Salvando...' : 'Salvar roteamento'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: confirmar exclusão roteamento ══ */}
      <DeleteConfirmDialog
        open={!!deleteRoutingTarget} name={deleteRoutingTarget?.description ?? deleteRoutingTarget?.ruleName ?? 'este roteamento'}
        onCancel={() => setDeleteRoutingTarget(null)}
        onConfirm={() => deleteRoutingMutation.mutate(deleteRoutingTarget.id)}
        isPending={deleteRoutingMutation.isPending} />

      {/* ══ DIALOG: criar/editar destinatário ══ */}
      <Dialog open={!!recipientDialogTarget} onOpenChange={(o) => { if (!o) { setRecipientDialogTarget(null); recipientForm.reset() } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{recipientDialogTarget?.id ? 'Editar destinatário' : 'Novo destinatário'}</DialogTitle>
            <DialogDescription>
              Destinatários são enviados no campo <code>payload.recipients</code> para o n8n.
            </DialogDescription>
          </DialogHeader>
          <Form {...recipientForm}>
            <form onSubmit={recipientForm.handleSubmit((v) => saveRecipientMutation.mutateAsync(v))} className="space-y-4" noValidate>
              <FormField control={recipientForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="Ex: Fiscal" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={recipientForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel><FormControl><Input type="email" placeholder="fiscal@empresa.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recipientForm.control} name="phoneNumber" render={({ field }) => (
                  <FormItem><FormLabel>Telefone <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel><FormControl><Input placeholder="+5582999999999" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={recipientForm.control} name="preferredChannels" render={({ field }) => (
                <FormItem>
                  <FormLabel>Canais preferidos</FormLabel>
                  <FormControl><ToggleSelect options={PREFERRED_CHANNEL_OPTIONS} value={field.value} onChange={field.onChange} /></FormControl>
                  <FormDescription className="text-xs">Define como o n8n deve contatar este destinatário</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={recipientForm.control} name="eventTypes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipos de evento</FormLabel>
                  <FormControl><ToggleSelect options={EVENT_TYPE_OPTIONS} value={field.value} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={recipientForm.control} name="contratoId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contrato ID <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl><Input placeholder="Deixe vazio para destinatário global" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={recipientForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl><Input placeholder="Ex: Responsável fiscal" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={recipientForm.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border px-3 py-2.5">
                  <div><FormLabel className="text-sm">Ativo</FormLabel></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRecipientDialogTarget(null)}>Cancelar</Button>
                <Button type="submit" disabled={saveRecipientMutation.isPending} data-testid="submit-recipient-btn">
                  {saveRecipientMutation.isPending ? 'Salvando...' : 'Salvar destinatário'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG: confirmar exclusão destinatário ══ */}
      <DeleteConfirmDialog
        open={!!deleteRecipientTarget} name={deleteRecipientTarget?.name}
        onCancel={() => setDeleteRecipientTarget(null)}
        onConfirm={() => deleteRecipientMutation.mutate(deleteRecipientTarget.id)}
        isPending={deleteRecipientMutation.isPending} />
    </div>
  )
}

// ─── Channel Card ─────────────────────────────────────────────────────────────

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
          <StatusBadge enabled={isEnabled} data-testid="channel-status-badge" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-muted/40 px-3 py-2.5 space-y-1.5 text-xs font-mono">
          <MetaRow label="URL" value={channel.endpointUrl} copyTitle="Copiar URL completa" />
          {channel.endpointOrigin && <MetaRow label="Origem" value={channel.endpointOrigin} />}
          {channel.webhookPath && <MetaRow label="Path" value={channel.webhookPath} copyTitle="Copiar path" />}
          {channel.webhookPathName && <MetaRow label="Nome do path" value={channel.webhookPathName} copyTitle="Copiar nome" hint="Use no campo Path do node Webhook no n8n" />}
        </div>

        {headerEntries.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Headers</p>
            {headerEntries.map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted-foreground">{key}:</span>
                <span className={val === '[REDACTED]' ? 'text-amber-600 italic' : ''}>{val}</span>
                {val === '[REDACTED]' && <span className="text-amber-600 text-[10px]">(mascarado)</span>}
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
            {isEnabled && (
              <Button variant="outline" size="sm" disabled={isTesting || isTogglingStatus} onClick={onTest} data-testid="test-channel-btn">
                <FlaskConical className="h-3.5 w-3.5 mr-1.5" />{isTesting ? 'Enviando...' : 'Testar'}
              </Button>
            )}
            {isEnabled ? (
              <Button variant="outline" size="sm" disabled={isTogglingStatus} onClick={() => onToggleStatus(false)} data-testid="disable-channel-btn">
                <PowerOff className="h-3.5 w-3.5 mr-1.5" />{isTogglingStatus ? 'Desativando...' : 'Desativar'}
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" disabled={isTogglingStatus} onClick={() => onToggleStatus(true)} data-testid="enable-channel-btn">
                  <Power className="h-3.5 w-3.5 mr-1.5" />{isTogglingStatus ? 'Reativando...' : 'Reativar'}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isTogglingStatus} onClick={onRequestDelete} data-testid="delete-channel-btn">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remover
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

// ─── Routing Card ─────────────────────────────────────────────────────────────

function RoutingCard({ routing, canManage, isToggling, onToggleStatus, onRequestDelete }) {
  const isEnabled = routing.enabled

  return (
    <Card data-testid="routing-row">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Route className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-sm font-medium">
              {routing.description ?? routing.ruleName ?? routing.channelName ?? '—'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <ScopeBadge contratoId={routing.contratoId} scopeType={routing.scopeType} />
            <StatusBadge enabled={isEnabled} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {routing.channelName && (
            <><span className="text-muted-foreground">Canal</span><span>{routing.channelName}</span></>
          )}
          {routing.contratoId && (
            <><span className="text-muted-foreground">Contrato</span><span className="font-mono">{routing.contratoId}</span></>
          )}
          {routing.dedupeWindowMinutes && (
            <><span className="text-muted-foreground">Dedup.</span><span>{routing.dedupeWindowMinutes}min</span></>
          )}
          {routing.createdAt && (
            <><span className="text-muted-foreground">Criado</span><span>{formatDate(routing.createdAt)}</span></>
          )}
        </div>

        {routing.eventTypes?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {routing.eventTypes.map((et) => (
              <Badge key={et} variant="secondary" className="text-xs">{eventTypeLabel(et)}</Badge>
            ))}
          </div>
        )}

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isEnabled ? (
              <Button variant="outline" size="sm" disabled={isToggling} onClick={() => onToggleStatus(false)} data-testid="disable-routing-btn">
                <PowerOff className="h-3.5 w-3.5 mr-1.5" />{isToggling ? 'Desativando...' : 'Desativar'}
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={isToggling} onClick={() => onToggleStatus(true)} data-testid="enable-routing-btn">
                <Power className="h-3.5 w-3.5 mr-1.5" />{isToggling ? 'Ativando...' : 'Ativar'}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={isToggling} onClick={onRequestDelete} data-testid="delete-routing-btn">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remover
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Recipient Card ───────────────────────────────────────────────────────────

function RecipientCard({ recipient, canManage, isToggling, onToggleStatus, onEdit, onRequestDelete }) {
  const isEnabled = recipient.enabled

  return (
    <Card data-testid="recipient-row">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-sm font-medium">{recipient.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <ScopeBadge contratoId={recipient.contratoId} />
            <StatusBadge enabled={isEnabled} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {recipient.email && <><span className="text-muted-foreground">Email</span><span>{recipient.email}</span></>}
          {recipient.phoneNumber && <><span className="text-muted-foreground">Telefone</span><span>{recipient.phoneNumber}</span></>}
          {recipient.contratoId && <><span className="text-muted-foreground">Contrato</span><span className="font-mono">{recipient.contratoId}</span></>}
          {recipient.createdAt && <><span className="text-muted-foreground">Criado</span><span>{formatDate(recipient.createdAt)}</span></>}
        </div>

        <div className="flex flex-wrap gap-1">
          {recipient.preferredChannels?.map((ch) => (
            <Badge key={ch} variant="outline" className="text-xs">{channelLabel(ch)}</Badge>
          ))}
          {recipient.eventTypes?.map((et) => (
            <Badge key={et} variant="secondary" className="text-xs">{eventTypeLabel(et)}</Badge>
          ))}
        </div>

        {recipient.notes && <p className="text-xs text-muted-foreground italic">{recipient.notes}</p>}

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onEdit} data-testid="edit-recipient-btn">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar
            </Button>
            {isEnabled ? (
              <Button variant="outline" size="sm" disabled={isToggling} onClick={() => onToggleStatus(false)} data-testid="disable-recipient-btn">
                <PowerOff className="h-3.5 w-3.5 mr-1.5" />{isToggling ? 'Desativando...' : 'Desativar'}
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={isToggling} onClick={() => onToggleStatus(true)} data-testid="enable-recipient-btn">
                <Power className="h-3.5 w-3.5 mr-1.5" />{isToggling ? 'Ativando...' : 'Ativar'}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={isToggling} onClick={onRequestDelete} data-testid="delete-recipient-btn">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remover
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
