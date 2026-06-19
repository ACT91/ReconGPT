import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { dataApi } from '@/services/api'
import { SeverityBadge, SkeletonTable, ErrorBoundary } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useProjectStore } from '@/store/project'
import type { AiInsight } from '@/types'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Download, Funnel, Lightbulb, MagnifyingGlass, Robot } from '@phosphor-icons/react'
import toast from 'react-hot-toast'

const columnHelper = createColumnHelper<AiInsight & { scan_job_id?: string }>()

const INSIGHT_TYPE_OPTIONS = ['all', 'recommendation', 'finding', 'observation', 'trend', 'anomaly']
const PRIORITY_OPTIONS = ['all', 'critical', 'high', 'medium', 'low', 'info']

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-neutral-800/50 rounded-lg p-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-neutral-50'}`}>{value}</p>
    </div>
  )
}

function SeverityChart({ data }: { data: Record<string, number> }) {
  const severities = [
    { key: 'critical', label: 'Critical', color: 'bg-red-500' },
    { key: 'high', label: 'High', color: 'bg-orange-500' },
    { key: 'medium', label: 'Medium', color: 'bg-yellow-500' },
    { key: 'low', label: 'Low', color: 'bg-blue-500' },
    { key: 'info', label: 'Info', color: 'bg-neutral-500' },
  ]
  const maxVal = Math.max(...severities.map((s) => data[s.key] || 0), 1)

  return (
    <div className="space-y-2">
      {severities.map((s) => {
        const val = data[s.key] || 0
        return (
          <div key={s.key}>
            <div className="flex justify-between text-xs text-neutral-400 mb-1">
              <span>{s.label}</span>
              <span>{val}</span>
            </div>
            <div className="h-2 bg-neutral-800 rounded-lg overflow-hidden">
              <div className={`h-full ${s.color} rounded-lg transition-all`} style={{ width: `${(val / maxVal) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AIAnalysisPage() {
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const [searchQuery, setSearchQuery] = useState('')
  const [scanIdFilter, setScanIdFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [actionableOnly, setActionableOnly] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'priority_score', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  const { data: stats } = useQuery({
    queryKey: ['data-stats', selectedProject?.id],
    queryFn: () => dataApi.getStats({ project_id: selectedProject?.id }),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['data-insights', pagination, searchQuery, scanIdFilter, typeFilter, priorityFilter, actionableOnly, selectedProject?.id],
    queryFn: () =>
      dataApi.listInsights({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        search: searchQuery || undefined,
        scan_id: scanIdFilter || undefined,
        project_id: selectedProject?.id,
        insight_type: typeFilter === 'all' ? undefined : typeFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        actionable_only: actionableOnly || undefined,
      }),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor('priority', {
        header: 'Priority',
        cell: (info) => <SeverityBadge severity={info.getValue()} />,
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <div className="flex items-center gap-2">
            {info.row.original.is_actionable && (
              <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
            <span className="text-sm text-neutral-200 font-medium">{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) => (
          <span className="text-xs text-neutral-500 bg-neutral-800/50 px-2 py-0.5 rounded capitalize">
            {info.getValue().replace(/_/g, ' ')}
          </span>
        ),
      }),
      columnHelper.accessor('summary', {
        header: 'Summary',
        cell: (info) => (
          <span className="text-xs text-neutral-400 truncate max-w-[300px] block">
            {info.getValue() || '\u2014'}
          </span>
        ),
      }),
      columnHelper.accessor('priority_score', {
        header: 'Score',
        cell: (info) => (
          <span className="text-sm text-neutral-400 font-mono">{info.getValue()?.toFixed(1)}</span>
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
    getPaginationRowModel: getPaginationRowModel(),
    pageCount: data ? Math.ceil((data.total || 0) / pagination.pageSize) : -1,
  })

  const handleExport = () => {
    if (!data?.items?.length) {
      toast.error('No insights to export')
      return
    }
    const csv = [
      'Priority,Title,Type,Summary,Score,Scan ID',
      ...data.items.map((i: any) =>
        [i.priority, `"${(i.title || '').replace(/"/g, '""')}"`, i.type, `"${(i.summary || '').replace(/"/g, '""')}"`, i.priority_score, i.scan_job_id || ''].join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `insights-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`Exported ${data.items.length} insights`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">AI Analysis</h1>
          <p className="text-sm text-neutral-400 mt-1">Automated intelligence and risk assessment across scans</p>
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

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Scans" value={stats.total_scans} color="text-primary" />
          <StatCard label="Subdomains" value={stats.total_subdomains} color="text-neutral-300" />
          <StatCard label="Endpoints" value={stats.total_endpoints} color="text-neutral-300" />
          <StatCard label="Findings" value={stats.total_vulnerabilities} color="text-neutral-300" />
          <StatCard label="Insights" value={stats.total_insights} color="text-neutral-300" />
          <StatCard label="Critical" value={stats.vulnerabilities_by_severity?.critical || 0} color="text-red-400" />
        </div>
      )}

      {stats && (
        <Card className="bg-neutral-900/50 border-neutral-800 mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-neutral-50 mb-4">Vulnerabilities by Severity</h2>
            <SeverityChart data={stats.vulnerabilities_by_severity} />
          </CardContent>
        </Card>
      )}

      <Card className="bg-neutral-900/50 border-neutral-800 mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3 items-end">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search insights..."
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
            <Funnel className="h-4 w-4 text-neutral-500 shrink-0" />
            {INSIGHT_TYPE_OPTIONS.map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === type ? 'bg-primary text-sidebar-bg' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {type === 'all' ? 'All Types' : type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </button>
            ))}
            <div className="w-px h-6 bg-neutral-800 mx-1" />
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  priorityFilter === p ? 'bg-primary text-sidebar-bg' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {p === 'all' ? 'All Priority' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
            <div className="w-px h-6 bg-neutral-800 mx-1" />
            <button
              onClick={() => setActionableOnly(!actionableOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                actionableOnly ? 'bg-primary text-sidebar-bg' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Actionable Only
            </button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
          <SkeletonTable rows={6} cols={6} />
        </div>
      ) : (
        <ErrorBoundary>
          {table.getRowModel().rows.length === 0 ? (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Robot className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No AI insights found</EmptyTitle>
                  <EmptyDescription>Insights are generated during scans with AI analysis enabled. Run a scan to see insights here.</EmptyDescription>
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
              <span className="text-sm text-neutral-500">{data?.total || 0} total insights</span>
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
