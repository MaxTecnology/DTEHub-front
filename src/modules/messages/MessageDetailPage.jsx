import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ChevronLeft,
  Download,
  Loader2,
  FileText,
  MessageSquareReply,
  User,
  Calendar,
  Hash,
} from 'lucide-react'
import { toast } from 'sonner'
import { getMessage, downloadDocument } from '@/api/messages'
import { ReadStateBadge } from '@/components/ReadStateBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

function formatDate(val) {
  if (!val) return '—'
  if (!val.includes('T')) {
    const [y, m, d] = val.split('-')
    return `${d}/${m}/${y}`
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(val))
}

export default function MessageDetailPage() {
  const { contratoId, messageId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const company = state?.company
  const [downloadingKey, setDownloadingKey] = useState(null)

  const { data: message, isLoading: msgLoading } = useQuery({
    queryKey: ['message', contratoId, messageId],
    queryFn: () => getMessage(contratoId, messageId),
    enabled: !!(contratoId && messageId),
  })

  const downloadMutation = useMutation({
    mutationFn: ({ msgId, docId }) => downloadDocument(contratoId, msgId, docId),
    onSettled: () => setDownloadingKey(null),
    onError: () => toast.error('Falha ao baixar documento'),
  })

  function handleDownload(msgId, docId) {
    const key = `${msgId}-${docId}`
    setDownloadingKey(key)
    downloadMutation.mutate({ msgId, docId })
  }

  const raw = message?.rawPayload ?? {}
  const remetente = raw.expedEmits?.[0]?.agente?.descricao
  const departamento = raw.expedEmits?.[0]?.agente?.departamento?.descricao
  const destinatario = raw.expedDests?.[0]?.agente?.descricao
  const atoNumero = raw.servicoRealizado?.atoNumero
  const respostas = raw.respostas ?? []

  // Apenas documentos validados pelo backend (com rota de download disponível)
  const documents = message?.documents ?? []

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
      {/* Voltar */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/companies/${contratoId}/messages`, { state: { company } })}
          className="gap-1 -ml-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Mensagens
        </Button>
      </div>

      {/* Card principal */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            {msgLoading ? (
              <Skeleton className="h-6 w-64" data-testid="skeleton" />
            ) : (
              <CardTitle className="text-base leading-snug">{message?.assunto ?? '—'}</CardTitle>
            )}
            {!msgLoading && <ReadStateBadge state={message?.readState} />}
          </div>
        </CardHeader>

        <CardContent>
          {/* Metadados */}
          {msgLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" data-testid="skeleton" />
              <Skeleton className="h-4 w-40" data-testid="skeleton" />
              <Skeleton className="h-4 w-56" data-testid="skeleton" />
              <Skeleton className="h-4 w-44" data-testid="skeleton" />
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
              <dt className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap sm:mt-0 -mb-1 sm:mb-0">
                <Calendar className="h-3.5 w-3.5" /> Enviado
              </dt>
              <dd className="font-medium">{formatDate(message?.messageDate)}</dd>

              {message?.readAt && (
                <>
                  <dt className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap sm:mt-0 -mb-1 sm:mb-0">
                    <Calendar className="h-3.5 w-3.5" /> Lido em
                  </dt>
                  <dd>{formatDate(message.readAt)}</dd>
                </>
              )}

              {remetente && (
                <>
                  <dt className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap sm:mt-0 -mb-1 sm:mb-0">
                    <User className="h-3.5 w-3.5" /> De
                  </dt>
                  <dd>
                    <span className="font-medium">{remetente}</span>
                    {departamento && (
                      <span className="ml-1.5 text-xs text-muted-foreground">— {departamento}</span>
                    )}
                  </dd>
                </>
              )}

              {destinatario && (
                <>
                  <dt className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap sm:mt-0 -mb-1 sm:mb-0">
                    <User className="h-3.5 w-3.5" /> Para
                  </dt>
                  <dd>{destinatario}</dd>
                </>
              )}

              {atoNumero && (
                <>
                  <dt className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap sm:mt-0 -mb-1 sm:mb-0">
                    <Hash className="h-3.5 w-3.5" /> Ato nº
                  </dt>
                  <dd className="font-mono text-xs">{atoNumero}</dd>
                </>
              )}
            </dl>
          )}

          {/* Conteúdo */}
          <Separator className="my-4" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Conteúdo
            </p>
            {msgLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" data-testid="skeleton" />
                <Skeleton className="h-4 w-3/4" data-testid="skeleton" />
                <Skeleton className="h-4 w-1/2" data-testid="skeleton" />
              </div>
            ) : message?.descricao ? (
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                data-testid="message-content"
              >
                {message.descricao}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem conteúdo.</p>
            )}
          </div>

          {/* Documentos da mensagem */}
          {documents.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Documentos ({documents.length})
                </p>
                <div className="space-y-2">
                  {documents.map((doc, idx) => {
                    const key = `${messageId}-${doc.documentoId}`
                    return (
                      <DocumentRow
                        key={doc.documentoId ?? idx}
                        id={doc.documentoId}
                        name={doc.nomeOriginal}
                        isDownloading={downloadingKey === key}
                        onDownload={() => handleDownload(messageId, doc.documentoId)}
                      />
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Thread de respostas */}
      {!msgLoading && respostas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
            <MessageSquareReply className="h-4 w-4" />
            <span className="font-medium">
              {respostas.length} {respostas.length === 1 ? 'resposta' : 'respostas'}
            </span>
          </div>

          {respostas.map((reply) => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              downloadingKey={downloadingKey}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentRow({ id, name, isDownloading, onDownload }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
      data-testid="document-row"
      data-document-id={id}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="truncate text-sm">{name ?? `Documento ${id}`}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onDownload}
        disabled={isDownloading}
        data-testid="download-btn"
        className="shrink-0"
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-1.5" />
        )}
        {isDownloading ? 'Baixando...' : 'Download'}
      </Button>
    </div>
  )
}

function ReplyCard({ reply, downloadingKey, onDownload }) {
  const remetente = reply.expedEmits?.[0]?.agente?.descricao

  return (
    <Card className="border-l-2 border-l-primary/40">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            {remetente && <p className="text-sm font-medium">{remetente}</p>}
            <p className="text-xs text-muted-foreground">{formatDate(reply.data)}</p>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            Resposta
          </Badge>
        </div>

        {reply.descricao && (
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {reply.descricao}
          </p>
        )}

        {reply.documentos?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Documentos ({reply.documentos.length})
            </p>
            {reply.documentos.map((doc) => {
              const key = `${reply.id}-${doc.id}`
              return (
                <DocumentRow
                  key={doc.id}
                  id={doc.id}
                  name={doc.nomeOriginal}
                  isDownloading={downloadingKey === key}
                  onDownload={() => onDownload(reply.id, doc.id)}
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
