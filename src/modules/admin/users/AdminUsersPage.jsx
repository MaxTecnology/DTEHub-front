import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { getUsers, createUser, patchUserStatus, resetPassword, getAuditLogs } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const createUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  fullName: z.string().min(1, 'Nome obrigatório'),
  role: z.enum(['admin', 'operator', 'viewer'], { required_error: 'Role obrigatória' }),
})

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso)
  )
}

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', operator: 'Operador', viewer: 'Viewer' }

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState(null) // userId
  const [activeTab, setActiveTab] = useState('users') // 'users' | 'audit'

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: getAuditLogs,
    enabled: activeTab === 'audit',
  })

  const createForm = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', password: '', fullName: '', role: '' },
  })

  const resetForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '' },
  })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      createForm.reset()
      toast.success('Usuário criado com sucesso')
    },
    onError: () => toast.error('Falha ao criar usuário'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }) => patchUserStatus(userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Status atualizado')
    },
    onError: () => toast.error('Falha ao atualizar status'),
  })

  const resetMutation = useMutation({
    mutationFn: ({ userId, newPassword }) => resetPassword(userId, { newPassword }),
    onSuccess: () => {
      setResetTarget(null)
      resetForm.reset()
      toast.success('Senha redefinida com sucesso')
    },
    onError: () => toast.error('Falha ao redefinir senha'),
  })

  async function onCreateSubmit(values) {
    await createMutation.mutateAsync(values)
  }

  async function onResetSubmit(values) {
    await resetMutation.mutateAsync({ userId: resetTarget, newPassword: values.newPassword })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Usuários</h1>
          <div className="flex gap-1 rounded-md border p-1">
            <button
              className={`px-3 py-1 text-sm rounded ${activeTab === 'users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('users')}
              data-testid="tab-users"
            >
              Usuários
            </button>
            <button
              className={`px-3 py-1 text-sm rounded ${activeTab === 'audit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('audit')}
              data-testid="tab-audit"
            >
              Auditoria
            </button>
          </div>
        </div>
        {activeTab === 'users' && (
          <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="create-user-btn">
            <Plus className="h-4 w-4 mr-1" />
            Criar usuário
          </Button>
        )}
      </div>

      {activeTab === 'users' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" data-testid="skeleton" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} data-testid="user-row">
                  <TableCell className="font-medium">{user.fullName ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.isActive ? 'outline' : 'secondary'}
                      className={user.isActive ? 'border-green-300 text-green-700' : ''}
                      data-testid="user-status-badge"
                    >
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          statusMutation.mutate({
                            userId: user.id,
                            status: user.isActive ? 'inactive' : 'active',
                          })
                        }
                        disabled={statusMutation.isPending}
                        data-testid="toggle-status-btn"
                      >
                        {user.isActive ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setResetTarget(user.id)}
                        data-testid="reset-password-btn"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {activeTab === 'audit' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ação</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" data-testid="skeleton" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : auditLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nenhum registro de auditoria.
                </TableCell>
              </TableRow>
            ) : (
              auditLogs.map((log, idx) => (
                <TableRow key={log.id ?? idx} data-testid="audit-row">
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.userEmail ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Dialog criar usuário */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar usuário</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4" noValidate>
              <FormField
                control={createForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="joao@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha temporária</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="role-select">
                          <SelectValue placeholder="Selecione a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="operator">Operador</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="submit-create-user-btn"
                >
                  {createMutation.isPending ? 'Criando...' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog reset de senha */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4" noValidate>
              <FormField
                control={resetForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetTarget(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={resetMutation.isPending}
                  data-testid="submit-reset-btn"
                >
                  {resetMutation.isPending ? 'Salvando...' : 'Redefinir'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
