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
import { dataApi, projectApi } from '@/services/api'
import { TechnologyBadges, SkeletonTable, ErrorBoundary } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useProjectStore } from '@/store/project'
import type { Subdomain, Project } from '@/types'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Download, Funnel, MagnifyingGlass, Globe } from '@phosphor-icons/react'

const columnHelper = createColumnHelper<Subdomain & { scan_job_id?: string }>()

type FilterMode = 'all' | 'scan_id' | 'project'

export function AssetsPage() {
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [scanIdValue, setScanIdValue] = useState('')
  const [filterProjectId, setFilterProjectId] = useState('')
  const [filterAlive, setFilterAlive] = useState<'all' | 'alive' | 'dead'>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list({ page_size: 100 }),
  })
  const projects = projectsData?.items || []

  const effectiveProjectId = filterMode === 'project' ? filterProjectId : selectedProject?.id || ''

  const { data, isLoading } = useQuery({
    queryKey: ['data-subdomains', pagination, sorting, searchQuery, filterMode, scanIdValue, effectiveProjectId, filterAlive],
    queryFn: () =>
      dataApi.listSubdomains({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        search: searchQuery || undefined,
        scan_id: filterMode === 'scan_id' ? scanIdValue || undefined : undefined,
        project_id: effectiveProjectId || undefined,
        status: filterAlive === 'all' ? undefined : filterAlive,
      }),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Domain',
        cell: (info) => <span className="font-medium text-neutral-50">{info.getValue()}</span>,
      }),
      columnHelper.accessor('is_alive', {
        header: 'Status',
        cell: (info) => (
          <span className={`inline-flex items-center gap-1 text-xs ${info.getValue() ? 'text-emerald-400' : 'text-neutral-500'}`}>
            <span className={`w-2 h-2 rounded-full ${info.getValue() ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
            {info.getValue() ? 'Live' : 'Dead'}
          </span>
        ),
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => <span className="text-sm text-neutral-400 truncate max-w-[200px] block">{info.getValue() || '\u2014'}</span>,
      }),
      columnHelper.accessor('status_code', {
        header: 'Status',
        cell: (info) => <span className="text-sm text-neutral-400">{info.getValue() || '\u2014'}</span>,
      }),
      columnHelper.accessor('web_server', {
        header: 'Web Server',
        cell: (info) => <span className="text-sm text-neutral-400">{info.getValue() || '\u2014'}</span>,
      }),
      columnHelper.accessor('technologies', {
        header: 'Technologies',
        cell: (info) => <TechnologyBadges technologies={info.getValue()} />,
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
    manualPagination: true,
    pageCount: data ? Math.ceil((data?.total || 0) / pagination.pageSize) : -1,
  })

  const handleExport = () => {
    if (!data?.items?.length) return
    const csv = [
      'Domain,Status,Title,Status Code,Web Server,Technologies,IPs,Scan ID',
      ...data.items.map((s: any) =>
        [
          s.name,
          s.is_alive ? 'Live' : 'Dead',
          s.title || '',
          s.status_code || '',
          s.web_server || '',
          (s.technologies || []).join('; '),
          (s.ips || []).join('; '),
          s.scan_job_id || '',
        ].join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `assets-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Assets</h1>
          <p className="text-sm text-neutral-400 mt-1">All discovered subdomains and hosts across scans</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <Badge variant="outline" className="text-neutral-400 text-xs">
              {selectedProject.name}
            </Badge>
          )}
          {data?.items?.length > 0 && (
            <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="pl-10"
              />
            </div>

            <div className="w-[180px]">
              <Select
                value={filterMode}
                placeholder="Filter by..."
                onChange={(v) => { setFilterMode(v as FilterMode); setScanIdValue(''); setFilterProjectId('') }}
                options={[
                  { value: 'all', label: 'All assets' },
                  { value: 'scan_id', label: 'Scan ID' },
                  { value: 'project', label: 'Project' },
                ]}
              />
            </div>

            {filterMode === 'scan_id' && (
              <div className="w-[220px]">
                <Input
                  type="text"
                  value={scanIdValue}
                  onChange={(e) => setScanIdValue(e.target.value)}
                  placeholder="Paste scan ID..."
                />
              </div>
            )}

            {filterMode === 'project' && (
              <div className="w-[200px]">
                <Select
                  value={filterProjectId}
                  placeholder="Choose a project..."
                  onChange={(v) => setFilterProjectId(v)}
                  options={projects.map((p: Project) => ({ value: p.id, label: p.name }))}
                />
              </div>
            )}

            <div className="flex gap-1.5">
              <Funnel className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
              {(['all', 'alive', 'dead'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterAlive(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterAlive === f
                      ? 'bg-primary text-sidebar-bg'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'alive' ? 'Live' : 'Dead'}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
          <SkeletonTable rows={8} cols={7} />
        </div>
      ) : (
        <ErrorBoundary>
          {table.getRowModel().rows.length === 0 ? (
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Globe className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No assets found</EmptyTitle>
                  <EmptyDescription>Try adjusting your search or filters, or start a scan to discover subdomains.</EmptyDescription>
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
                            className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-neutral-300"
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
                <span className="text-sm text-neutral-500">{data?.total || 0} total assets</span>
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
