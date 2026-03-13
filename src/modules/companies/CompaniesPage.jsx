import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCompanies } from '@/api/companies'
import { Badge } from '@/components/ui/badge'
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

const PAGE_SIZE = 20

function formatCNPJ(doc) {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (d.length !== 14) return doc
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export default function CompaniesPage() {
  const navigate = useNavigate()
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { onlyWithUnread: onlyUnread, page }],
    queryFn: () =>
      getCompanies({
        page,
        pageSize: PAGE_SIZE,
        ...(onlyUnread ? { onlyWithUnread: true } : {}),
      }),
    staleTime: 30_000,
  })

  const companies = data?.data ?? []
  const meta = data?.meta
  const totalPages = meta?.totalPages ?? 1

  function handleFilterToggle() {
    setOnlyUnread((v) => !v)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Empresas</h1>
        <Button
          variant={onlyUnread ? 'default' : 'outline'}
          size="sm"
          onClick={handleFilterToggle}
          data-testid="filter-unread-btn"
        >
          {onlyUnread ? 'Mostrar todas' : 'Somente não lidas'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Insc. Estadual</TableHead>
            <TableHead>Contrato ID</TableHead>
            <TableHead className="text-center">Não lidas</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-48" data-testid="skeleton" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-36" data-testid="skeleton" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" data-testid="skeleton" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" data-testid="skeleton" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8 mx-auto" data-testid="skeleton" />
                </TableCell>
                <TableCell />
              </TableRow>
            ))
          ) : companies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhuma empresa encontrada.
              </TableCell>
            </TableRow>
          ) : (
            companies.map((company) => (
              <TableRow
                key={company.contratoId}
                data-testid="company-row"
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/companies/${company.contratoId}/messages`, { state: { company } })}
              >
                <TableCell className="font-medium">{company.descricao}</TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">
                  {formatCNPJ(company.documento)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">
                  {company.inscricaoCompleta ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">
                  {company.contratoId}
                </TableCell>
                <TableCell className="text-center">
                  {company.unreadMessages > 0 ? (
                    <Badge
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      data-testid="unread-count-badge"
                    >
                      {company.unreadMessages}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/companies/${company.contratoId}/messages`, { state: { company } })
                    }}
                  >
                    Ver mensagens
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {meta?.page ?? page} de {totalPages}
            {meta?.totalItems ? ` · ${meta.totalItems} empresas` : ''}
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
