import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, CheckCircle, XCircle, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCertificates,
  uploadCertificate,
  activateCertificate,
  revokeCertificate,
  testLoginCertificate,
} from '@/api/certificates'
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

const uploadSchema = z.object({
  label: z.string().min(1, 'Label obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
  file: z
    .instanceof(FileList)
    .refine((f) => f.length > 0, 'Selecione um arquivo .pfx')
    .refine(
      (f) => f[0]?.name?.endsWith('.pfx'),
      'Apenas arquivos .pfx são aceitos'
    ),
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso)
  )
}

const STATUS_LABELS = { active: 'Ativo', revoked: 'Revogado', pending: 'Pendente' }

function CertStatusBadge({ status }) {
  const isActive = status === 'active'
  const isRevoked = status === 'revoked'
  return (
    <Badge
      variant={isRevoked ? 'destructive' : isActive ? 'outline' : 'secondary'}
      className={isActive ? 'border-green-300 text-green-700' : ''}
      data-testid="cert-status-badge"
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

export default function AdminCertificatesPage() {
  const queryClient = useQueryClient()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [testResult, setTestResult] = useState(null) // { certId, steps, refreshed, error }

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: getCertificates,
  })

  const form = useForm({
    resolver: zodResolver(uploadSchema),
    defaultValues: { label: '', password: '' },
  })

  const uploadMutation = useMutation({
    mutationFn: (formData) => uploadCertificate(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] })
      setUploadOpen(false)
      form.reset()
      toast.success('Certificado enviado com sucesso')
    },
    onError: (err) => {
      const msg =
        err.response?.status === 400
          ? 'Arquivo inválido ou senha incorreta.'
          : 'Erro ao enviar certificado.'
      form.setError('root', { message: msg })
    },
  })

  const activateMutation = useMutation({
    mutationFn: activateCertificate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] })
      toast.success('Certificado ativado')
    },
    onError: () => toast.error('Falha ao ativar certificado'),
  })

  const revokeMutation = useMutation({
    mutationFn: revokeCertificate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] })
      toast.success('Certificado revogado')
    },
    onError: () => toast.error('Falha ao revogar certificado'),
  })

  const testMutation = useMutation({
    mutationFn: testLoginCertificate,
    onSuccess: (data, certId) => {
      setTestResult({ certId, steps: data?.steps ?? [], refreshed: data?.auth?.refreshed })
    },
    onError: (err, certId) => {
      setTestResult({ certId, steps: [], error: err.response?.data?.message ?? 'Erro no teste.' })
    },
  })

  async function onUploadSubmit(values) {
    const formData = new FormData()
    formData.append('file', values.file[0])
    formData.append('password', values.password)
    formData.append('label', values.label)
    await uploadMutation.mutateAsync(formData)
  }

  const activeCert = certificates.find((c) => c.status === 'active')

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Certificados</h1>
        <Button size="sm" onClick={() => setUploadOpen(true)} data-testid="upload-cert-btn">
          <Upload className="h-4 w-4 mr-1" />
          Enviar certificado
        </Button>
      </div>

      {/* Certificado ativo em destaque */}
      {activeCert && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <CardTitle className="text-sm text-green-700">Certificado ativo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-green-700">
            <p className="font-medium">{activeCert.label}</p>
            <p className="text-xs mt-0.5">
              Válido até {formatDate(activeCert.expiresAt)} · Testado em{' '}
              {formatDate(activeCert.lastTestedAt)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista de certificados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Todos os certificados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" data-testid="skeleton" />
              <Skeleton className="h-14 w-full" data-testid="skeleton" />
            </div>
          ) : certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="no-certs-message">
              Nenhum certificado cadastrado.
            </p>
          ) : (
            certificates.map((cert, idx) => (
              <div key={cert.id ?? idx}>
                {idx > 0 && <Separator className="mb-3" />}
                <div className="flex items-center justify-between gap-4" data-testid="cert-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{cert.label}</p>
                      <CertStatusBadge status={cert.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Válido até {formatDate(cert.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testMutation.mutate(cert.id)}
                      disabled={testMutation.isPending}
                      data-testid="test-cert-btn"
                    >
                      {testMutation.isPending && testMutation.variables === cert.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Testar'
                      )}
                    </Button>
                    {cert.status !== 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => activateMutation.mutate(cert.id)}
                        disabled={activateMutation.isPending}
                        data-testid="activate-cert-btn"
                      >
                        Ativar
                      </Button>
                    )}
                    {cert.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => revokeMutation.mutate(cert.id)}
                        disabled={revokeMutation.isPending}
                        data-testid="revoke-cert-btn"
                      >
                        Revogar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Resultado do teste */}
      {testResult && (
        <Card
          className={
            testResult.error
              ? 'border-red-200'
              : testResult.refreshed
              ? 'border-green-200'
              : 'border-yellow-200'
          }
          data-testid="test-result-card"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {testResult.error ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : testResult.refreshed ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-yellow-600" />
              )}
              <CardTitle className="text-sm">Resultado do teste</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {testResult.error ? (
              <p className="text-red-600">{testResult.error}</p>
            ) : (
              <>
                {testResult.steps.map((step, i) => (
                  <p key={i} className="text-muted-foreground">
                    {step}
                  </p>
                ))}
                {testResult.refreshed && (
                  <p className="text-green-600 font-medium">Autenticação renovada com sucesso.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog upload */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar certificado PFX</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUploadSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Certificado A1 2025" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="file"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Arquivo .pfx</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".pfx"
                        onChange={(e) => onChange(e.target.files)}
                        {...rest}
                        data-testid="pfx-file-input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha do certificado</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  data-testid="submit-upload-btn"
                >
                  {uploadMutation.isPending ? 'Enviando...' : 'Enviar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
