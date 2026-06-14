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
import { useQuery } from '@tanstack/react-query'
import { scanApi } from '@/services/api'
import { SeverityBadge, SkeletonTable, ErrorBoundary } from '@/components/common'
import type { Vulnerability } from '@/types'

const columnHelper = createColumnHelper<Vulnerability>()

function VulnDetailPanel({ vuln, onClose }: { vuln: Vulnerability; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={vuln.severity} />
            <h2 className="text-lg font-semibold text-white">{vuln.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase">Template ID</label>
            <p className="text-sm text-gray-300 font-mono">{vuln.template_id}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase">URL</label>
            <p className="text-sm text-blue-400 truncate">{vuln.url}</p>
          </div>
          {vuln.description && (
            <div>
              <label className="text-xs text-gray-500 uppercase">Description</label>
              <p className="text-sm text-gray-300">{vuln.description}</p>
            </div>
          )}
          {vuln.remediation && (
            <div>
              <label className="text-xs text-gray-500 uppercase">Remediation</label>
              <p className="text-sm text-gray-300">{vuln.remediation}</p>
            </div>
          )}
          {vuln.cve_ids && vuln.cve_ids.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 uppercase">CVE IDs</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {vuln.cve_ids.map((cve) => (
                  <span key={cve} className="px-2 py-0.5 rounded text-xs bg-red-900/30 text-red-300">{cve}</span>
                ))}
              </div>
            </div>
          )}
          {vuln.cvss_score && (
            <div>
              <label className="text-xs text-gray-500 uppercase">CVSS Score</label>
              <p className="text-sm text-gray-300">{vuln.cvss_score}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function FindingsPage() {
  const [jobId, setJobId] = useState('')
  const [inputJobId, setInputJobId] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'severity', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null)

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

  const columns = useMemo(
    () => [
      columnHelper.accessor('severity', {
        header: 'Severity',
        cell: (info) => <SeverityBadge severity={info.getValue()} />,
      }),
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => <span className="font-medium text-white">{info.getValue()}</span>,
      }),
      columnHelper.accessor('url', {
        header: 'Endpoint',
        cell: (info) => <span className="text-sm text-gray-400 truncate max-w-[250px] block">{info.getValue()}</span>,
      }),
      columnHelper.accessor('template_id', {
        header: 'Template',
        cell: (info) => <span className="text-sm font-mono text-gray-400">{info.getValue()}</span>,
      }),
      columnHelper.accessor('cvss_score', {
        header: 'CVSS',
        cell: (info) => <span className="text-sm text-gray-400">{info.getValue() || '—'}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button onClick={() => setSelectedVuln(row.original)} className="text-sm text-blue-400 hover:text-blue-300">
              Details
            </button>
          </div>
        ),
      }),
    ],
    []
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
    data.items.forEach((v) => {
      counts[v.severity] = (counts[v.severity] || 0) + 1
    })
    return counts
  }, [data])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-light text-white">Findings</h1>
          <p className="text-gray-400 text-sm mt-1">Vulnerabilities discovered during scans</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={inputJobId}
          onChange={(e) => setInputJobId(e.target.value)}
          placeholder="Enter scan job ID..."
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
        />
        <button
          onClick={() => setJobId(inputJobId)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          Load Findings
        </button>
      </div>

      {!jobId ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">Enter a scan job ID to view its findings</p>
        </div>
      ) : (
        <>
          {data && (
            <div className="flex gap-2 mb-4">
              {['', 'critical', 'high', 'medium', 'low', 'info'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    severityFilter === sev
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {sev ? `${sev.charAt(0).toUpperCase() + sev.slice(1)}${severityCounts[sev] ? ` (${severityCounts[sev]})` : ''}` : 'All'}
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <SkeletonTable rows={6} cols={6} />
            </div>
          ) : (
            <ErrorBoundary><div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b border-gray-800">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-white"
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
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer" onClick={() => setSelectedVuln(row.original)}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                <span className="text-sm text-gray-400">{data?.total || 0} total findings</span>
                <div className="flex gap-2">
                  <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 disabled:opacity-50">
                    Prev
                  </button>
                  <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 disabled:opacity-50">
                    Next
                  </button>
                </div>
              </div>
            </div>
            </ErrorBoundary>
          )}

          {selectedVuln && (
            <VulnDetailPanel vuln={selectedVuln} onClose={() => setSelectedVuln(null)} />
          )}
        </>
      )}
    </div>
  )
}