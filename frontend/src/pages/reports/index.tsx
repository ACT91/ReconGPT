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
import type { Vulnerability } from '@/types'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { FileCode, FileXls, FileText, MagnifyingGlass } from '@phosphor-icons/react'
import toast from 'react-hot-toast'

const columnHelper = createColumnHelper<Vulnerability & { scan_job_id?: string }>()

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-neutral-800/50 rounded-lg p-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-neutral-50'}`}>{value}</p>
    </div>
  )
}

function SeverityBar({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1
  const segments = [
    { key: 'critical', color: 'bg-red-500' },
    { key: 'high', color: 'bg-orange-500' },
    { key: 'medium', color: 'bg-yellow-500' },
    { key: 'low', color: 'bg-blue-500' },
    { key: 'info', color: 'bg-neutral-500' },
  ]
  return (
    <div className="h-3 bg-neutral-800 rounded-lg overflow-hidden flex">
      {segments.map((s) => {
        const pct = ((data[s.key] || 0) / total) * 100
        if (pct === 0) return null
        return (
          <div
            key={s.key}
            className={`h-full ${s.color} transition-all`}
            style={{ width: `${pct}%` }}
            title={`${s.key}: ${data[s.key]}`}
          />
        )
      })}
    </div>
  )
}

export function ReportsPage() {
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const [searchQuery, setSearchQuery] = useState('')
  const [scanIdFilter, setScanIdFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'severity', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  const { data: stats } = useQuery({
    queryKey: ['data-stats-reports', selectedProject?.id],
    queryFn: () => dataApi.getStats({ project_id: selectedProject?.id }),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['data-vulnerabilities-reports', pagination, sorting, searchQuery, scanIdFilter, severityFilter, selectedProject?.id],
    queryFn: () =>
      dataApi.listVulnerabilities({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        search: searchQuery || undefined,
        scan_id: scanIdFilter || undefined,
        project_id: selectedProject?.id,
        severity: severityFilter || undefined,
      }),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor('severity', {
        header: 'Severity',
        cell: (info) => <SeverityBadge severity={info.getValue()} />,
      }),
      columnHelper.accessor('name', {
        header: 'Finding',
        cell: (info) => (
          <span className="text-sm text-neutral-200 font-medium">{info.getValue()}</span>
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

  const handleExportJSON = () => {
    if (!data?.items?.length) {
      toast.error('No findings to export')
      return
    }
    const exportData = {
      generated_at: new Date().toISOString(),
      project: selectedProject?.name || 'All Projects',
      total_findings: data.total,
      findings: data.items,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `reconny-report-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('JSON report downloaded')
  }

  const handleExportCSV = () => {
    if (!data?.items?.length) {
      toast.error('No findings to export')
      return
    }
    const csv = [
      'Severity,Name,Template ID,URL,Description,CVSS,Scan ID',
      ...data.items.map((v: any) =>
        [
          v.severity,
          `"${(v.name || '').replace(/"/g, '""')}"`,
          v.template_id || '',
          v.url || '',
          `"${(v.description || '').replace(/"/g, '""')}"`,
          v.cvss_score || '',
          v.scan_job_id || '',
        ].join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `reconny-findings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('CSV report downloaded')
  }

  const severityBreakdown: Record<string, number> = stats?.vulnerabilities_by_severity || {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Reports</h1>
          <p className="text-sm text-neutral-400 mt-1">Generate and export scan reports across all scans</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <Badge variant="outline" className="text-neutral-400 text-xs">
              {selectedProject.name}
            </Badge>
          )}
          <Button onClick={handleExportJSON} variant="outline" size="sm" className="border-neutral-700 text-neutral-300 gap-2">
            <FileCode className="h-4 w-4" />
            JSON
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="border-neutral-700 text-neutral-300 gap-2">
            <FileXls className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Total Scans" value={stats.total_scans} color="text-primary" />
            <StatCard label="Subdomains" value={stats.total_subdomains} color="text-neutral-300" />
            <StatCard label="Endpoints" value={stats.total_endpoints} color="text-neutral-300" />
            <StatCard label="Findings" value={stats.total_vulnerabilities} color="text-neutral-300" />
          </div>

          <Card className="bg-neutral-900/50 border-neutral-800 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-neutral-300">
                  Severity Breakdown ({Object.values(severityBreakdown).reduce((a, b) => a + b, 0)} total)
                </h2>
                <div className="flex gap-3 text-xs text-neutral-500">
                  {[
                    { key: 'critical', label: 'Critical', color: 'text-red-400' },
                    { key: 'high', label: 'High', color: 'text-orange-400' },
                    { key: 'medium', label: 'Medium', color: 'text-yellow-400' },
                    { key: 'low', label: 'Low', color: 'text-blue-400' },
                    { key: 'info', label: 'Info', color: 'text-neutral-400' },
                  ].map((s) => (
                    <span key={s.key} className={s.color}>
                      {s.label}: {severityBreakdown[s.key] || 0}
                    </span>
                  ))}
                </div>
              </div>
              <SeverityBar data={severityBreakdown} />
            </CardContent>
          </Card>
        </>
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
                {sev ? sev.charAt(0).toUpperCase() + sev.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
          <SkeletonTable rows={8} cols={6} />
        </div>
      ) : (
        <ErrorBoundary>
          {table.getRowModel().rows.length === 0 ? (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No findings to report</EmptyTitle>
                  <EmptyDescription>Run a scan with vulnerability detection to generate findings.</EmptyDescription>
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
          )}
        </ErrorBoundary>
      )}
    </div>
  )
}
