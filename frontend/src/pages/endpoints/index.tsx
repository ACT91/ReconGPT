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
import { dataApi, getApiError } from '@/services/api'
import { ErrorBoundary, SkeletonTable } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { useProjectStore } from '@/store/project'
import type { Endpoint } from '@/types'
import { Download, Funnel, MagnifyingGlass, Globe, Link } from '@phosphor-icons/react'
import toast from 'react-hot-toast'

const columnHelper = createColumnHelper<Endpoint & { scan_job_id?: string }>()

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-neutral-600/10 text-neutral-300',
  POST: 'bg-primary/10 text-primary',
  PUT: 'bg-neutral-600/10 text-neutral-300',
  PATCH: 'bg-neutral-600/10 text-neutral-300',
  DELETE: 'bg-neutral-800/50 text-neutral-300',
  OPTIONS: 'bg-purple-900/30 text-neutral-300',
  HEAD: 'bg-neutral-700 text-neutral-300',
}

const SOURCE_OPTIONS = ['all', 'reconstructed', 'crawl', 'js_mining', 'gau', 'manual']

export function EndpointsPage() {
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const [searchQuery, setSearchQuery] = useState('')
  const [scanIdFilter, setScanIdFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'url', desc: false }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  const { data, isLoading, error } = useQuery({
    queryKey: ['data-endpoints', pagination, sorting, searchQuery, scanIdFilter, sourceFilter, selectedProject?.id],
    queryFn: () =>
      dataApi.listEndpoints({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        search: searchQuery || undefined,
        scan_id: scanIdFilter || undefined,
        project_id: selectedProject?.id,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
      }),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor('method', {
        header: 'Method',
        cell: (info) => (
          <span
            className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
              METHOD_COLORS[info.getValue()] || 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('url', {
        header: 'URL',
        cell: (info) => (
          <span className="text-sm text-neutral-200 truncate max-w-[400px] block font-mono">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('status_code', {
        header: 'Status',
        cell: (info) => (
          <span className={`text-sm font-mono ${info.getValue() ? 'text-neutral-300' : 'text-neutral-600'}`}>
            {info.getValue() || '\u2014'}
          </span>
        ),
      }),
      columnHelper.accessor('source', {
        header: 'Source',
        cell: (info) => (
          <span className="text-xs text-neutral-500 bg-neutral-800/50 px-2 py-0.5 rounded">
            {info.getValue()?.replace(/_/g, ' ')}
          </span>
        ),
      }),
      columnHelper.accessor('content_type', {
        header: 'Content Type',
        cell: (info) => (
          <span className="text-xs text-neutral-500 truncate max-w-[150px] block">
            {info.getValue() || '\u2014'}
          </span>
        ),
      }),
      columnHelper.accessor('scan_job_id', {
        header: 'Scan ID',
        cell: (info) => (
          <span className="text-xs text-neutral-500 font-mono">
            {info.getValue() ? (info.getValue() as string).slice(0, 8) + '...' : '\u2014'}
          </span>
        ),
      }),
    ],
    [],
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
    pageCount: data ? Math.ceil((data.total || 0) / pagination.pageSize) : -1,
  })

  const handleExport = () => {
    if (!data?.items?.length) {
      toast.error('No endpoints to export')
      return
    }
    const csv = [
      'Method,URL,Status Code,Source,Content Type,Scan ID',
      ...data.items.map((e: any) =>
        [e.method, e.url, e.status_code || '', e.source, e.content_type || '', e.scan_job_id || ''].join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `endpoints-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`Exported ${data.items.length} endpoints`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Endpoints</h1>
          <p className="text-sm text-neutral-400 mt-1">All discovered API endpoints and URLs across scans</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <Badge variant="outline" className="text-neutral-400 text-xs">
              {selectedProject.name}
            </Badge>
          )}
          {data?.items?.length > 0 && (
            <Button onClick={handleExport} variant="outline" size="sm" className="border-neutral-700 text-neutral-300 gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
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
                placeholder="Search endpoints..."
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
          <div className="flex items-center gap-2">
            <Funnel className="h-4 w-4 text-neutral-500 shrink-0" />
            {SOURCE_OPTIONS.map((src) => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sourceFilter === src
                    ? 'bg-primary text-sidebar-bg'
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {src === 'all' ? 'All' : src.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
          <SkeletonTable rows={8} cols={6} />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <Globe className="h-12 w-12 text-neutral-700 mx-auto mb-4" />
          <p className="text-lg text-neutral-400">Failed to load endpoints</p>
          <p className="text-sm text-neutral-600 mt-1">{getApiError(error)}</p>
        </div>
      ) : (
        <ErrorBoundary>
          {table.getRowModel().rows.length === 0 ? (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Link className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No endpoints found</EmptyTitle>
                  <EmptyDescription>Try adjusting your search or filters, or run a scan to discover endpoints.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
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
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
                <span className="text-sm text-neutral-500">{data?.total || 0} total endpoints</span>
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
          )}
        </ErrorBoundary>
      )}
    </div>
  )
}
