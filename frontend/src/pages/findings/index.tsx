import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataApi, scanApi, getApiError } from '@/services/api'
import { SeverityBadge, SkeletonTable, ErrorBoundary } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useProjectStore } from '@/store/project'
import type { Vulnerability } from '@/types'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Flag, ProhibitInset, MagnifyingGlass, X, WarningCircle } from '@phosphor-icons/react'
import toast from 'react-hot-toast'

const columnHelper = createColumnHelper<Vulnerability & { scan_job_id?: string }>()

function VulnDetailPanel({ vuln, onClose, onToggleFP }: { vuln: Vulnerability; onClose: () => void; onToggleFP: (vuln: Vulnerability) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between sticky top-0 bg-neutral-900">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={vuln.severity} />
            <h2 className="text-lg font-semibold text-neutral-100">{vuln.name}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider">Template ID</label>
              <p className="text-sm text-neutral-300 font-mono mt-1">{vuln.template_id}</p>
            </div>
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider">CVSS Score</label>
              <p className="text-sm text-neutral-300 font-mono mt-1">{vuln.cvss_score || 'N/A'}</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wider">URL</label>
            <p className="text-sm text-primary truncate mt-1 font-mono">{vuln.url}</p>
          </div>
          {vuln.description && (
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider">Description</label>
              <p className="text-sm text-neutral-300 mt-1 leading-relaxed">{vuln.description}</p>
            </div>
          )}
          {vuln.remediation && (
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider">Remediation</label>
              <p className="text-sm text-neutral-300 mt-1 leading-relaxed">{vuln.remediation}</p>
            </div>
          )}
          {vuln.cve_ids && vuln.cve_ids.length > 0 && (
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider">CVE IDs</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {vuln.cve_ids.map((cve) => (
                  <span key={cve} className="px-2 py-0.5 rounded text-xs bg-neutral-800/50 text-neutral-300 font-mono">{cve}</span>
                ))}
              </div>
            </div>
          )}
          {vuln.matched_at && (
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wider">Matched At</label>
              <p className="text-sm text-neutral-400 mt-1 font-mono">{vuln.matched_at}</p>
            </div>
          )}
          <div className="pt-4 border-t border-neutral-800 flex gap-2">
            <Button
              onClick={() => onToggleFP(vuln)}
              variant="outline"
              className={`gap-2 ${vuln.is_false_positive ? 'border-amber-700 text-neutral-300' : 'border-neutral-700 text-neutral-300'}`}
            >
              {vuln.is_false_positive ? <ProhibitInset className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
              {vuln.is_false_positive ? 'Unmark False Positive' : 'Mark False Positive'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FindingsPage() {
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const [searchQuery, setSearchQuery] = useState('')
  const [scanIdFilter, setScanIdFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [showFP, setShowFP] = useState<'all' | 'real' | 'fp'>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'severity', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['data-vulnerabilities', pagination, sorting, searchQuery, scanIdFilter, severityFilter, showFP, selectedProject?.id],
    queryFn: () =>
      dataApi.listVulnerabilities({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        search: searchQuery || undefined,
        scan_id: scanIdFilter || undefined,
        project_id: selectedProject?.id,
        severity: severityFilter || undefined,
        is_false_positive: showFP === 'fp' ? true : showFP === 'real' ? false : undefined,
      }),
  })

  const fpMutation = useMutation({
    mutationFn: ({ vulnId, isFP }: { vulnId: string; isFP: boolean }) => {
      const jobId = selectedVuln?.scan_job_id || ''
      return scanApi.markFalsePositive(jobId, vulnId, isFP)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-vulnerabilities'] })
      toast.success('Finding updated')
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor('severity', {
        header: 'Severity',
        cell: (info) => <SeverityBadge severity={info.getValue()} />,
      }),
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <div className="flex items-center gap-2">
            {info.row.original.is_false_positive && (
              <ProhibitInset className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
            )}
            <span className={`font-medium ${info.row.original.is_false_positive ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
              {info.getValue()}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor('url', {
        header: 'Endpoint',
        cell: (info) => (
          <span className="text-sm text-neutral-400 truncate max-w-[250px] block font-mono">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('template_id', {
        header: 'Template',
        cell: (info) => <span className="text-sm font-mono text-neutral-500">{info.getValue()}</span>,
      }),
      columnHelper.accessor('cvss_score', {
        header: 'CVSS',
        cell: (info) => <span className="text-sm text-neutral-400 font-mono">{info.getValue() || '\u2014'}</span>,
      }),
      columnHelper.accessor('scan_job_id', {
        header: 'Scan ID',
        cell: (info) => (
          <span className="text-xs text-neutral-500 font-mono">
            {info.getValue() ? (info.getValue() as string).slice(0, 8) + '...' : '\u2014'}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedVuln(row.original)
              }}
              className="text-sm text-primary hover:text-primary/80"
            >
              Details
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const v = row.original
                fpMutation.mutate({ vulnId: v.id, isFP: !v.is_false_positive })
              }}
              className={`text-sm ${row.original.is_false_positive ? 'text-neutral-300' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {row.original.is_false_positive ? 'Unmark' : 'FP'}
            </button>
          </div>
        ),
      }),
    ],
    [fpMutation],
  )

  const table = useReactTable({
    data: data?.items || [],
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil((data?.total || 0) / pagination.pageSize) : -1,
  })

  const severityCounts = useMemo(() => {
    if (!data?.items) return {}
    const counts: Record<string, number> = {}
    data.items.forEach((v: any) => {
      counts[v.severity] = (counts[v.severity] || 0) + 1
    })
    return counts
  }, [data])

  const fpCount = useMemo(() => data?.items?.filter((v: any) => v.is_false_positive).length || 0, [data])

  const toggleFP = (vuln: Vulnerability) => {
    const v = selectedVuln || vuln
    fpMutation.mutate({ vulnId: v.id, isFP: !v.is_false_positive })
    setSelectedVuln(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Findings</h1>
          <p className="text-sm text-neutral-400 mt-1">All vulnerabilities discovered across scans</p>
        </div>
        {selectedProject && (
          <Badge variant="outline" className="text-neutral-400 text-xs">
            {selectedProject.name}
          </Badge>
        )}
      </div>

      <Card className="bg-neutral-900/50 border-neutral-800 mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3 items-end">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search findings..."
                className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg pl-10 pr-4 py-2.5 text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <input
              type="text"
              value={scanIdFilter}
              onChange={(e) => setScanIdFilter(e.target.value)}
              placeholder="Filter by Scan ID..."
              className="bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {['', 'critical', 'high', 'medium', 'low', 'info'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  severityFilter === sev
                    ? 'bg-primary text-sidebar-bg'
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {sev ? `${sev.charAt(0).toUpperCase() + sev.slice(1)}${severityCounts[sev] ? ` (${severityCounts[sev]})` : ''}` : `All (${data?.total || 0})`}
              </button>
            ))}
            <div className="w-px h-6 bg-neutral-800 mx-1" />
            {(['all', 'real', 'fp'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setShowFP(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                  showFP === opt ? 'bg-primary text-sidebar-bg' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {opt === 'all' ? 'All' : opt === 'real' ? 'Real' : 'FP'}
                {opt === 'fp' && fpCount > 0 && <span className={showFP === 'fp' ? 'text-sidebar-bg/70' : 'text-neutral-300'}>({fpCount})</span>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
          <SkeletonTable rows={6} cols={7} />
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WarningCircle className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No findings found</EmptyTitle>
              <EmptyDescription>Try adjusting your filters or run a scan with vulnerability detection enabled.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <ErrorBoundary>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-neutral-800">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-neutral-300 transition-colors"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: ' \u2191', desc: ' \u2193' }[header.column.getIsSorted() as string] ?? null}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors cursor-pointer ${row.original.is_false_positive ? 'opacity-60' : ''}`}
                        onClick={() => setSelectedVuln(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
              <span className="text-sm text-neutral-500">{data?.total || 0} total findings</span>
              <div className="flex gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="px-3 py-1.5 bg-neutral-800 rounded-lg text-sm text-neutral-300 disabled:opacity-50 hover:bg-neutral-700 transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="px-3 py-1.5 bg-neutral-800 rounded-lg text-sm text-neutral-300 disabled:opacity-50 hover:bg-neutral-700 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {selectedVuln && (
        <VulnDetailPanel vuln={selectedVuln} onClose={() => setSelectedVuln(null)} onToggleFP={toggleFP} />
      )}
    </div>
  )
}
