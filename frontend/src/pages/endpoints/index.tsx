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
import { useQuery } from '@tanstack/react-query'
import { resultApi, getApiError } from '@/services/api'
import { ErrorBoundary, SkeletonTable } from '@/components/common'
import { Button } from '@/components/ui/button'
import type { Endpoint } from '@/types'
import { Globe, Filter, Download, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const columnHelper = createColumnHelper<Endpoint>()

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-900/30 text-green-400',
  POST: 'bg-blue-900/30 text-blue-400',
  PUT: 'bg-yellow-900/30 text-yellow-400',
  PATCH: 'bg-orange-900/30 text-orange-400',
  DELETE: 'bg-red-900/30 text-red-400',
  OPTIONS: 'bg-purple-900/30 text-purple-400',
  HEAD: 'bg-zinc-700 text-zinc-300',
}

const SOURCE_OPTIONS = ['all', 'reconstructed', 'crawl', 'js_mining', 'gau', 'manual']

function SourceFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {SOURCE_OPTIONS.map((src) => (
        <button
          key={src}
          onClick={() => onChange(src)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === src
              ? 'bg-sidebar-active text-sidebar-bg'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {src === 'all' ? 'All' : src.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </button>
      ))}
    </div>
  )
}

export function EndpointsPage() {
  const { scanId } = useParams<{ scanId: string }>()
  const [jobId, setJobId] = useState(scanId || '')
  const [inputJobId, setInputJobId] = useState(scanId || '')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'url', desc: false }])
  const [sourceFilter, setSourceFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  const { data: fullResults, isLoading, error } = useQuery({
    queryKey: ['scan-full-results', jobId],
    queryFn: () => resultApi.getFull(jobId),
    enabled: !!jobId,
    retry: false,
  })

  const endpoints = useMemo(() => {
    if (!fullResults?.endpoints) return []
    let items = fullResults.endpoints
    if (sourceFilter !== 'all') {
      items = items.filter((e) => e.source === sourceFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (e) =>
          e.url.toLowerCase().includes(q) ||
          e.path?.toLowerCase().includes(q) ||
          e.method.toLowerCase().includes(q),
      )
    }
    return items
  }, [fullResults, sourceFilter, searchQuery])

  const columns = useMemo(
    () => [
      columnHelper.accessor('method', {
        header: 'Method',
        cell: (info) => (
          <span
            className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
              METHOD_COLORS[info.getValue()] || 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('url', {
        header: 'URL',
        cell: (info) => (
          <span className="text-sm text-zinc-200 truncate max-w-[400px] block font-mono">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('status_code', {
        header: 'Status',
        cell: (info) => {
          const code = info.getValue()
          const color = code
            ? code < 300
              ? 'text-green-400'
              : code < 400
              ? 'text-yellow-400'
              : code < 500
              ? 'text-orange-400'
              : 'text-red-400'
            : 'text-zinc-600'
          return <span className={`text-sm font-mono ${color}`}>{code || '—'}</span>
        },
      }),
      columnHelper.accessor('source', {
        header: 'Source',
        cell: (info) => (
          <span className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded">
            {info.getValue()?.replace(/_/g, ' ')}
          </span>
        ),
      }),
      columnHelper.accessor('content_type', {
        header: 'Content Type',
        cell: (info) => (
          <span className="text-xs text-zinc-500 truncate max-w-[150px] block">
            {info.getValue() || '—'}
          </span>
        ),
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <span className="text-xs text-zinc-400 truncate max-w-[150px] block">
            {info.getValue() || '—'}
          </span>
        ),
      }),
      columnHelper.accessor('technologies', {
        header: 'Tech',
        cell: (info) => {
          const techs = info.getValue()
          if (!techs || techs.length === 0) return <span className="text-xs text-zinc-600">—</span>
          return (
            <div className="flex gap-1 flex-wrap">
              {techs.slice(0, 3).map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {t}
                </span>
              ))}
              {techs.length > 3 && (
                <span className="text-[10px] text-zinc-500">+{techs.length - 3}</span>
              )}
            </div>
          )
        },
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: endpoints,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    pageCount: Math.ceil(endpoints.length / pagination.pageSize),
  })

  const handleExport = () => {
    if (endpoints.length === 0) {
      toast.error('No endpoints to export')
      return
    }
    const csv = [
      'Method,URL,Status Code,Source,Content Type,Title,Technologies',
      ...endpoints.map((e) =>
        [
          e.method,
          e.url,
          e.status_code || '',
          e.source,
          e.content_type || '',
          e.title || '',
          (e.technologies || []).join('; '),
        ].join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `endpoints-${jobId || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${endpoints.length} endpoints`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Endpoints</h1>
          <p className="text-sm text-zinc-400 mt-1">Discovered API endpoints and URLs</p>
        </div>
        {endpoints.length > 0 && (
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:text-zinc-100 gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
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
            Load Endpoints
          </Button>
        </div>
      </div>

      {!jobId ? (
        <div className="text-center py-20">
          <Globe className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-lg text-zinc-400">Enter a scan job ID</p>
          <p className="text-sm text-zinc-600 mt-1">Load endpoints from a completed scan</p>
        </div>
      ) : (
        <ErrorBoundary>
          {isLoading ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <SkeletonTable rows={8} cols={7} />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-zinc-400">Failed to load endpoints</p>
              <p className="text-sm text-zinc-600 mt-1">{getApiError(error)}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <Filter className="h-4 w-4 text-zinc-500" />
                <SourceFilter value={sourceFilter} onChange={setSourceFilter} />
                <div className="flex-1" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search endpoints..."
                  className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sidebar-active/50 w-48"
                />
              </div>

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
                              {{
                                asc: ' ↑',
                                desc: ' ↓',
                              }[header.column.getIsSorted() as string] ?? null}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={columns.length}
                            className="text-center py-12 text-zinc-500"
                          >
                            No endpoints match the current filters
                          </td>
                        </tr>
                      ) : (
                        table.getRowModel().rows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
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
                  <span className="text-sm text-zinc-500">
                    Page {pagination.pageIndex + 1} of{' '}
                    {Math.max(1, Math.ceil(endpoints.length / pagination.pageSize))}
                  </span>
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
            </>
          )}
        </ErrorBoundary>
      )}
    </div>
  )
}
