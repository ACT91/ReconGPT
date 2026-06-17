import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
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
import { scanApi, getApiError } from '@/services/api'
import { SeverityBadge, SkeletonTable, ErrorBoundary } from '@/components/common'
import { Button } from '@/components/ui/button'
import type { Vulnerability } from '@/types'
import { Flag, FlagOff, AlertTriangle, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'

const columnHelper = createColumnHelper<Vulnerability>()

function VulnDetailPanel({ vuln, onClose, onToggleFP }: { vuln: Vulnerability; onClose: () => void; onToggleFP: (vuln: Vulnerability) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={vuln.severity} />
            <h2 className="text-lg font-semibold text-zinc-100">{vuln.name}</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Template ID</label>
              <p className="text-sm text-zinc-300 font-mono mt-1">{vuln.template_id}</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">CVSS Score</label>
              <p className="text-sm text-zinc-300 font-mono mt-1">{vuln.cvss_score || 'N/A'}</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider">URL</label>
            <p className="text-sm text-blue-400 truncate mt-1 font-mono">{vuln.url}</p>
          </div>
          {vuln.description && (
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Description</label>
              <p className="text-sm text-zinc-300 mt-1 leading-relaxed">{vuln.description}</p>
            </div>
          )}
          {vuln.remediation && (
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Remediation</label>
              <p className="text-sm text-green-400 mt-1 leading-relaxed">{vuln.remediation}</p>
            </div>
          )}
          {vuln.cve_ids && vuln.cve_ids.length > 0 && (
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">CVE IDs</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {vuln.cve_ids.map((cve) => (
                  <span key={cve} className="px-2 py-0.5 rounded text-xs bg-red-900/30 text-red-300 font-mono">{cve}</span>
                ))}
              </div>
            </div>
          )}
          {vuln.matched_at && (
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Matched At</label>
              <p className="text-sm text-zinc-400 mt-1 font-mono">{vuln.matched_at}</p>
            </div>
          )}
          <div className="pt-4 border-t border-zinc-800 flex gap-3">
            <Button
              onClick={() => onToggleFP(vuln)}
              variant="outline"
              className={`gap-2 ${vuln.is_false_positive ? 'border-yellow-700 text-yellow-400 hover:text-yellow-300' : 'border-zinc-700 text-zinc-300 hover:text-zinc-100'}`}
            >
              {vuln.is_false_positive ? <FlagOff className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
              {vuln.is_false_positive ? 'Unmark False Positive' : 'Mark False Positive'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FindingsPage() {
  const { scanId } = useParams<{ scanId: string }>()
  const [jobId, setJobId] = useState(scanId || '')
  const [inputJobId, setInputJobId] = useState(scanId || '')
  const [severityFilter, setSeverityFilter] = useState('')
  const [showFP, setShowFP] = useState<'all' | 'real' | 'fp'>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'severity', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['vulnerabilities', jobId, pagination, sorting, severityFilter],
    queryFn: () =>
      scanApi.getVulnerabilities(jobId, {
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort: sorting.length > 0 ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : undefined,
        severity: severityFilter || undefined,
      }),
    enabled: !!jobId,
  })

  const fpMutation = useMutation({
    mutationFn: ({ vulnId, isFP }: { vulnId: string; isFP: boolean }) =>
      scanApi.markFalsePositive(jobId, vulnId, isFP),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vulnerabilities', jobId] })
      toast.success('Finding updated')
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const filteredData = useMemo(() => {
    if (!data?.items) return []
    let items = data.items
    if (showFP === 'real') items = items.filter((v) => !v.is_false_positive)
    if (showFP === 'fp') items = items.filter((v) => v.is_false_positive)
    return items
  }, [data, showFP])

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
              <FlagOff className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            )}
            <span className={`font-medium ${info.row.original.is_false_positive ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
              {info.getValue()}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor('url', {
        header: 'Endpoint',
        cell: (info) => (
          <span className="text-sm text-zinc-400 truncate max-w-[250px] block font-mono">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('template_id', {
        header: 'Template',
        cell: (info) => <span className="text-sm font-mono text-zinc-500">{info.getValue()}</span>,
      }),
      columnHelper.accessor('cvss_score', {
        header: 'CVSS',
        cell: (info) => <span className="text-sm text-zinc-400 font-mono">{info.getValue() || '—'}</span>,
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
              className="text-sm text-sidebar-active hover:text-sidebar-active/80"
            >
              Details
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const v = row.original
                fpMutation.mutate({ vulnId: v.id, isFP: !v.is_false_positive })
              }}
              className={`text-sm ${row.original.is_false_positive ? 'text-yellow-400 hover:text-yellow-300' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={row.original.is_false_positive ? 'Unmark as false positive' : 'Mark as false positive'}
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
    data: filteredData,
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
    data.items.forEach((v) => {
      counts[v.severity] = (counts[v.severity] || 0) + 1
    })
    return counts
  }, [data])

  const fpCount = useMemo(() => {
    return data?.items?.filter((v) => v.is_false_positive).length || 0
  }, [data])

  const toggleFP = (vuln: Vulnerability) => {
    fpMutation.mutate({ vulnId: vuln.id, isFP: !vuln.is_false_positive })
    setSelectedVuln(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Findings</h1>
          <p className="text-sm text-zinc-400 mt-1">Vulnerabilities discovered during scans</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={inputJobId}
              onChange={(e) => setInputJobId(e.target.value)}
              placeholder="Enter scan job ID..."
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sidebar-active/50"
            />
          </div>
          <Button
            onClick={() => setJobId(inputJobId)}
            className="bg-sidebar-active text-sidebar-bg hover:bg-sidebar-active/90"
          >
            Load Findings
          </Button>
        </div>
      </div>

      {!jobId ? (
        <div className="text-center py-20">
          <AlertTriangle className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-lg text-zinc-400">Enter a scan job ID</p>
          <p className="text-sm text-zinc-600 mt-1">Load findings from a completed scan</p>
        </div>
      ) : (
        <>
          {data && (
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <div className="flex gap-1.5">
                {['', 'critical', 'high', 'medium', 'low', 'info'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      severityFilter === sev
                        ? 'bg-sidebar-active text-sidebar-bg'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {sev
                      ? `${sev.charAt(0).toUpperCase() + sev.slice(1)}${severityCounts[sev] ? ` (${severityCounts[sev]})` : ''}`
                      : `All (${data.total})`}
                  </button>
                ))}
              </div>
              <div className="w-px h-6 bg-zinc-800 mx-1" />
              <div className="flex gap-1.5">
                {(['all', 'real', 'fp'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setShowFP(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                      showFP === opt
                        ? 'bg-sidebar-active text-sidebar-bg'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt === 'all' ? 'All' : opt === 'real' ? 'Real' : 'FP'}
                    {opt === 'fp' && fpCount > 0 && (
                      <span className={`${showFP === 'fp' ? 'text-sidebar-bg/70' : 'text-yellow-500'}`}>
                        ({fpCount})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <SkeletonTable rows={6} cols={6} />
            </div>
          ) : (
            <ErrorBoundary>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="border-b border-zinc-800">
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-zinc-300 transition-colors"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="text-center py-12 text-zinc-500">
                            No findings match the current filters
                          </td>
                        </tr>
                      ) : (
                        table.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            className={`border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors cursor-pointer ${
                              row.original.is_false_positive ? 'opacity-60' : ''
                            }`}
                            onClick={() => setSelectedVuln(row.original)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="px-4 py-3">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
                  <span className="text-sm text-zinc-500">{data?.total || 0} total findings</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm text-zinc-300 disabled:opacity-50 hover:bg-zinc-700 transition-colors"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm text-zinc-300 disabled:opacity-50 hover:bg-zinc-700 transition-colors"
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
        </>
      )}
    </div>
  )
}
