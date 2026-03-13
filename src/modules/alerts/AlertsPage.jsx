import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Webhook, CheckCircle, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { getChannels, createChannel, getDeliveries } from '@/api/alerts'
import { useSession } from '@/store/session'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const ROLE_WEIGHT = { owner: 4, admin: 3, operator: 2, viewer: 1 }

const channelSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  url: z.string().url('URL inválida'),
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function DeliveryStatusIcon({ status }) {
  if (status === 'sent') return <CheckCircle className="h-4 w-4 text-green-600" />
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-600" />
  return <Clock className="h-4 w-4 text-yellow-600" />
}

function deliveryStatusLabel(status) {
  const labels = { sent: 'Enviado', failed: 'Falhou', retrying: 'Tentando' }
  return labels[status] ?? status
}

export default function AlertsPage() {
  const { role } = useSession()
  const queryClient = useQueryClient()
  const canManage = (ROLE_WEIGHT[role] ?? 0) >= ROLE_WEIGHT.admin
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['alert-channels'],
    queryFn: getChannels,
  })

  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuery({
    queryKey: ['alert-deliveries'],
    queryFn: getDeliveries,
  })

  const form = useForm({
    resolver: zodResolver(channelSchema),
    defaultValues: { name: '', url: '' },
  })

  const createMutation = useMutation({
    mutationFn: createChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-channels'] })
      setDialogOpen(false)
      form.reset()
      toast.success('Canal criado com sucesso')
    },
    onError: () => toast.error('Falha ao criar canal'),
  })

  async function onSubmit(values) {
    await createMutation.mutateAsync({ ...values, type: 'webhook' })
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Canais */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Canais de notificação</CardTitle>
            {canManage && (
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                data-testid="add-channel-btn"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar canal
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {channelsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" data-testid="skeleton" />
              <Skeleton className="h-12 w-full" data-testid="skeleton" />
            </div>
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="no-channels-message">
              Nenhum canal configurado.
            </p>
          ) : (
            channels.map((channel, idx) => (
              <div key={channel.id ?? idx}>
                {idx > 0 && <Separator className="mb-3" />}
                <div className="flex items-center justify-between gap-4" data-testid="channel-row">
                  <div className="flex items-center gap-2 min-w-0">
                    <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{channel.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{channel.url}</p>
                    </div>
                  </div>
                  <Badge
                    variant={channel.active ? 'outline' : 'secondary'}
                    className={channel.active ? 'border-green-300 text-green-700' : ''}
                    data-testid="channel-status-badge"
                  >
                    {channel.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Entregas recentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Entregas recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deliveriesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" data-testid="skeleton" />
              <Skeleton className="h-10 w-full" data-testid="skeleton" />
            </div>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="no-deliveries-message">
              Nenhuma entrega registrada.
            </p>
          ) : (
            deliveries.map((delivery, idx) => (
              <div key={delivery.id ?? idx}>
                {idx > 0 && <Separator className="mb-3" />}
                <div className="flex items-center justify-between gap-4" data-testid="delivery-row">
                  <div className="flex items-center gap-2">
                    <DeliveryStatusIcon status={delivery.status} />
                    <div>
                      <p className="text-sm font-medium">{delivery.channelName ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(delivery.sentAt)}</p>
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

      {/* Dialog criar canal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar canal de notificação</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Slack produção" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do webhook</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://hooks.slack.com/..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="submit-channel-btn"
                >
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
