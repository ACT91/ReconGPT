import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
import { scanApi, projectApi, getApiError } from '@/services/api'
import { useProjectStore } from '@/store/project'
import { useScanWebSocket } from '@/hooks/useScanWebSocket'
import { ScanProgressBar, StatusBadge, LiveLogsViewer, SkeletonTable, ErrorBoundary } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import type { ScanJob, ScanProgress, ScanLogEntry, Project } from '@/types'
import { Globe, Network, WarningCircle, Robot, FileText, FloppyDisk, RocketLaunch } from '@phosphor-icons/react'
import toast from 'react-hot-toast'

const columnHelper = createColumnHelper<ScanJob>()

function NewScanModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [targetDomain, setTargetDomain] = useState('')
  const [projectId, setProjectId] = useState('')
  const [runVulnScan, setRunVulnScan] = useState(true)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const selectedProject = useProjectStore((s) => s.selectedProject)

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list({ page_size: 100 }),
  })

  const projects = projectsData?.items || []
  const effectiveProjectId = projectId || selectedProject?.id || ''

  const startScan = useMutation({
    mutationFn: (data: { target_domain: string; project_id?: string; config?: Record<string, unknown> }) =>
      scanApi.start(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      onClose()
      setTargetDomain('')
      setProjectId('')
      setRunVulnScan(true)
    },
    onError: (err) => setError(getApiError(err)),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-neutral-50 mb-4">New Scan</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700 text-neutral-300 text-sm">{error}</div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            startScan.mutate({
              target_domain: targetDomain,
              project_id: effectiveProjectId || undefined,
              config: { vuln_scan: runVulnScan },
            })
          }}
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Target Domain</label>
            <input
              type="text"
              value={targetDomain}
              onChange={(e) => setTargetDomain(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="example.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Project (optional)</label>
            <select
              value={effectiveProjectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">{selectedProject ? selectedProject.name : 'No project selected'}</option>
              {projects.map((p: Project) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="run-vuln-scan"
              checked={runVulnScan}
              onChange={(e) => setRunVulnScan(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-primary focus:ring-primary/50"
            />
            <label htmlFor="run-vuln-scan" className="text-sm text-neutral-300">
              Run vulnerability scan (takes longer)
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-neutral-300 hover:text-neutral-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={startScan.isPending}
              className="px-4 py-2 bg-primary text-sidebar-bg hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {startScan.isPending ? 'Starting...' : 'Start Scan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ScanDetailPanel({ job, onClose }: { job: ScanJob; onClose: () => void }) {
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [logs, setLogs] = useState<ScanLogEntry[]>([])
  const [activeTab, setActiveTab] = useState<'progress' | 'logs'>('progress')
  const queryClient = useQueryClient()

  const { data: progressData } = useQuery({
    queryKey: ['scan-progress', job.id],
    queryFn: () => scanApi.getProgress(job.id),
    refetchInterval: job.status === 'running' || job.status === 'queued' ? 2000 : false,
    enabled: job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled',
  })

  const { data: logsData } = useQuery({
    queryKey: ['scan-logs', job.id],
    queryFn: () => scanApi.getLogs(job.id, { page_size: 100 }),
    refetchInterval: job.status === 'running' ? 3000 : false,
  })

  useScanWebSocket({
    jobId: job.id,
    enabled: job.status === 'running' || job.status === 'queued',
    onLog: (msg) => {
      setLogs((prev) => [
        ...prev,
        {
          stage: msg.stage,
          level: msg.level || 'info',
          message: msg.message || '',
          details: msg.details,
        },
      ])
    },
    onProgress: (msg) => {
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              overall_progress: msg.progress || prev.overall_progress,
              current_stage: (msg.stage as any) || prev.current_stage,
            }
          : prev
      )
    },
    onStatus: (msg) => {
      if (msg.status === 'completed' || msg.status === 'failed') {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['scans'] })
          onClose()
        }, 3000)
      }
    },
  })

  const vulnScanMutation = useMutation({
    mutationFn: () => scanApi.runVulnScan(job.id),
    onSuccess: () => {
      toast.success('Vulnerability scan started')
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      onClose()
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const displayProgress = progressData || progress
  const displayLogs = logsData?.items || logs

  const canRunVulnScan = (job.status === 'completed' || job.status === 'partial') && !vulnScanMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-neutral-50">{job.target_domain}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={job.status} />
              <span className="text-sm text-neutral-400">Started {new Date(job.created_at).toLocaleString()}</span>
              {job.project_id && (
                <Badge variant="outline" className="text-xs text-neutral-500">
                  Project: {job.project_id.slice(0, 8)}...
                </Badge>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-50 text-xl">&times;</button>
        </div>

        <div className="px-4 py-2 border-b border-neutral-800 flex gap-2 flex-wrap">
          <Link to={`/assets/${job.id}`} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-primary transition-colors">
            <Globe className="h-3.5 w-3.5" /> Assets
          </Link>
          <Link to={`/endpoints/${job.id}`} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-primary transition-colors">
            <Network className="h-3.5 w-3.5" /> Endpoints
          </Link>
          <Link to={`/findings/${job.id}`} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-primary transition-colors">
            <WarningCircle className="h-3.5 w-3.5" /> Findings
          </Link>
          <Link to={`/ai-analysis/${job.id}`} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-primary transition-colors">
            <Robot className="h-3.5 w-3.5" /> AI Analysis
          </Link>
          <Link to={`/reports/${job.id}`} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-primary transition-colors">
            <FileText className="h-3.5 w-3.5" /> Reports
          </Link>
          {canRunVulnScan && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                vulnScanMutation.mutate()
              }}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <FloppyDisk className="h-3.5 w-3.5" /> Run Vuln Scan
            </button>
          )}
        </div>

        <div className="flex border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'progress' ? 'text-primary border-b-2 border-primary' : 'text-neutral-400 hover:text-neutral-50'}`}
          >
            Progress
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'logs' ? 'text-primary border-b-2 border-primary' : 'text-neutral-400 hover:text-neutral-50'}`}
          >
            Live Logs
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'progress' && displayProgress && (
            <div className="space-y-6">
              <ScanProgressBar progress={displayProgress.overall_progress} status={job.status} size="lg" />
              <div className="grid grid-cols-2 gap-4">
                {displayProgress.stages?.map((stage) => (
                  <div key={stage.stage} className="bg-neutral-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-neutral-300 truncate">{stage.stage.replace(/\d+_/, '').replace(/_/g, ' ')}</span>
                      <StatusBadge status={stage.status} />
                    </div>
                    <ScanProgressBar progress={stage.progress_percent} status={stage.status} size="sm" showLabel={false} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'logs' && <LiveLogsViewer logs={displayLogs} maxHeight="60vh" />}
        </div>

        {(job.status === 'running' || job.status === 'queued') && (
          <div className="p-4 border-t border-neutral-800">
            <button
              onClick={async () => {
                try {
                  await scanApi.cancel(job.id)
                } catch {}
              }}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-neutral-50 rounded-lg text-sm transition-colors"
            >
              Cancel Scan
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ScansPage() {
  const [showNewScan, setShowNewScan] = useState(false)
  const [selectedJob, setSelectedJob] = useState<ScanJob | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const selectedProject = useProjectStore((s) => s.selectedProject)

  const { data: scansData, isLoading } = useQuery({
    queryKey: ['scans', pagination, sorting, globalFilter, selectedProject?.id],
    queryFn: () =>
      scanApi.list({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort: sorting.length > 0 ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : undefined,
        search: globalFilter || undefined,
        ...(selectedProject?.id ? { project_id: selectedProject.id } : {}),
      }),
  })

  const queryClient = useQueryClient()
  const cancelScan = useMutation({
    mutationFn: (jobId: string) => scanApi.cancel(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scans'] }),
  })

  const vulnScanMutation = useMutation({
    mutationFn: (jobId: string) => scanApi.runVulnScan(jobId),
    onSuccess: () => {
      toast.success('Vulnerability scan started')
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor('target_domain', {
        header: 'Target',
        cell: (info) => <span className="font-medium text-neutral-50">{info.getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('current_stage', {
        header: 'Stage',
        cell: (info) => (
          <span className="text-sm text-neutral-400">
            {info.getValue() ? info.getValue()!.replace(/\d+_/, '').replace(/_/g, ' ') : '\u2014'}
          </span>
        ),
      }),
      columnHelper.accessor('progress_percent', {
        header: 'Progress',
        cell: (info) => <ScanProgressBar progress={info.getValue()} status={info.row.original.status} size="sm" />,
      }),
      columnHelper.accessor('created_at', {
        header: 'Created',
        cell: (info) => (
          <span className="text-sm text-neutral-400">{new Date(info.getValue()).toLocaleDateString()}</span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setSelectedJob(row.original)}
              className="text-sm text-primary hover:text-primary"
            >
              View
            </button>
            {(row.original.status === 'completed' || row.original.status === 'partial') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  vulnScanMutation.mutate(row.original.id)
                }}
                className="text-sm text-amber-400 hover:text-amber-300"
                title="Run vulnerability scan"
              >
                Vuln
              </button>
            )}
            {(row.original.status === 'running' || row.original.status === 'queued') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  cancelScan.mutate(row.original.id)
                }}
                className="text-sm text-neutral-300 hover:text-neutral-300"
              >
                Cancel
              </button>
            )}
          </div>
        ),
      }),
    ],
    [cancelScan, vulnScanMutation]
  )

  const table = useReactTable({
    data: scansData?.items || [],
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: scansData ? Math.ceil(scansData.total / pagination.pageSize) : -1,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Scans</h1>
          <p className="text-sm text-neutral-400 mt-1">Manage and monitor your reconnaissance scans</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <Badge variant="outline" className="text-neutral-400 text-xs">
              {selectedProject.name}
            </Badge>
          )}
          <Button
            onClick={() => setShowNewScan(true)}
            className="bg-primary text-sidebar-bg hover:bg-primary/90 gap-2"
          >
            + New Scan
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search scans..."
          className="w-full max-w-xs bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <ErrorBoundary>
      {isLoading ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <SkeletonTable rows={6} cols={6} />
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RocketLaunch className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No scans yet</EmptyTitle>
              <EmptyDescription>Start your first scan to begin discovering assets and vulnerabilities.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-neutral-800">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-neutral-50"
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
                  <tr
                    key={row.id}
                    className="border-b border-neutral-800/50 hover:bg-neutral-800/30 cursor-pointer"
                    onClick={() => setSelectedJob(row.original)}
                  >
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
          <span className="text-sm text-neutral-400">
            Page {pagination.pageIndex + 1} of {scansData ? Math.max(1, Math.ceil(scansData.total / pagination.pageSize)) : 1} ({scansData?.total || 0} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 bg-neutral-800 rounded text-sm text-neutral-300 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 bg-neutral-800 rounded text-sm text-neutral-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      )}
      </ErrorBoundary>

      <NewScanModal open={showNewScan} onClose={() => setShowNewScan(false)} />
      {selectedJob && <ScanDetailPanel job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  )
}
