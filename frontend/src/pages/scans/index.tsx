import { useState, useMemo, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import type { ScanJob, ScanProgress, ScanLogEntry, Project } from '@/types'
import { Globe, Network, WarningCircle, Robot, FileText, FloppyDisk, RocketLaunch, Trash, Warning } from '@phosphor-icons/react'
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['scans'] })
      await queryClient.refetchQueries({ queryKey: ['scans'] })
      toast.success('Scan started successfully')
      onClose()
      setTargetDomain('')
      setProjectId('')
      setRunVulnScan(true)
      setError('')
    },
    onError: (err) => {
      const errMsg = getApiError(err)
      setError(errMsg)
      toast.error(errMsg)
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New Scan</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
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
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="target-domain">Target Domain</Label>
            <Input
              id="target-domain"
              type="text"
              value={targetDomain}
              onChange={(e) => setTargetDomain(e.target.value)}
              placeholder="example.com"
              required
            />
          </div>

          <Checkbox
            id="run-vuln-scan"
            checked={runVulnScan}
            onChange={(e) => setRunVulnScan(e.target.checked)}
            label="Run vulnerability scan (takes longer)"
          />

          <div className="space-y-2">
            <Label htmlFor="project-select">Project (optional)</Label>
            <Select
              id="project-select"
              value={effectiveProjectId}
              placeholder={selectedProject ? selectedProject.name : 'No project selected'}
              onChange={(v) => setProjectId(v)}
              options={projects.map((p: Project) => ({ value: p.id, label: p.name }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={startScan.isPending}>
              {startScan.isPending ? 'Starting...' : 'Start Scan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const mergedLogs = useMemo(() => {
    const restLogs = logsData?.items || []
    if (restLogs.length === 0) return logs
    const seen = new Set(logs.map((l) => `${l.timestamp}|${l.message}`))
    const deduped = logs.slice()
    for (const l of restLogs) {
      const key = `${l.timestamp}|${l.message}`
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(l)
      }
    }
    return deduped.sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    )
  }, [logsData, logs])

  const canRunVulnScan = (job.status === 'completed' || job.status === 'partial') && !vulnScanMutation.isPending

  return (
    <Dialog open={!!job} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div className="min-w-0">
            <DialogTitle className="text-xl truncate">{job.target_domain}</DialogTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge status={job.status} />
              <span className="text-xs text-muted-foreground">Started {new Date(job.created_at).toLocaleString()}</span>
              {job.project_id && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Project: {job.project_id.slice(0, 8)}...
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-2 border-b border-border flex gap-3 flex-wrap">
          <Link to={`/assets/${job.id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <Globe className="h-3.5 w-3.5" /> Assets
          </Link>
          <Link to={`/endpoints/${job.id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <Network className="h-3.5 w-3.5" /> Endpoints
          </Link>
          <Link to={`/findings/${job.id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <WarningCircle className="h-3.5 w-3.5" /> Findings
          </Link>
          <Link to={`/ai-analysis/${job.id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <Robot className="h-3.5 w-3.5" /> AI Analysis
          </Link>
          <Link to={`/reports/${job.id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
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

        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'progress' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Progress
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'logs' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
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

          {activeTab === 'logs' && <LiveLogsViewer logs={mergedLogs} maxHeight="60vh" />}
        </div>

        {(() => {
          const currentStatus = progressData?.overall_status ?? job.status
          return (currentStatus === 'running' || currentStatus === 'queued') && (
            <div className="p-4 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  try {
                    await scanApi.cancel(job.id)
                  } catch (err) {
                    toast.error(getApiError(err))
                  }
                }}
              >
                Cancel Scan
              </Button>
            </div>
          )
        })()}
      </DialogContent>
    </Dialog>
  )
}

export function ScansPage() {
  const { scanId } = useParams()
  const [showNewScan, setShowNewScan] = useState(false)
  const [selectedJob, setSelectedJob] = useState<ScanJob | null>(null)
  const [deletingJob, setDeletingJob] = useState<ScanJob | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const selectedProject = useProjectStore((s) => s.selectedProject)

  const { data: scanFromUrl, isLoading: scanFromUrlLoading } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: () => scanApi.get(scanId!),
    enabled: !!scanId,
  })

  useEffect(() => {
    if (scanFromUrl) {
      setSelectedJob(scanFromUrl)
    }
  }, [scanFromUrl])

  const { data: scansData, isLoading: scansLoading } = useQuery({
    queryKey: ['scans', pagination, sorting, globalFilter, selectedProject?.id],
    queryFn: () =>
      scanApi.list({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort: sorting.length > 0 ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : undefined,
        search: globalFilter || undefined,
        ...(selectedProject?.id ? { project_id: selectedProject.id } : {}),
      }),
    refetchInterval: 5000,
  })

  const queryClient = useQueryClient()
  const cancelScan = useMutation({
    mutationFn: (jobId: string) => scanApi.cancel(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scans'] }),
    onError: (err) => toast.error(getApiError(err)),
  })

  const vulnScanMutation = useMutation({
    mutationFn: (jobId: string) => scanApi.runVulnScan(jobId),
    onSuccess: () => {
      toast.success('Vulnerability scan started')
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const deleteScan = useMutation({
    mutationFn: (jobId: string) => scanApi.delete(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      toast.success('Scan deleted')
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
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeletingJob(row.original)
              }}
              className="p-1 rounded text-neutral-500 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete scan"
            >
              <Trash className="h-3.5 w-3.5" />
            </button>
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
      {scansLoading || scanFromUrlLoading ? (
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

      {/* Delete Scan Confirmation */}
      <Dialog open={!!deletingJob} onOpenChange={(open) => !open && setDeletingJob(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <Warning className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center text-neutral-100">Delete Scan</DialogTitle>
            <DialogDescription className="text-center text-neutral-400">
              Are you sure you want to delete the scan for <strong className="text-neutral-200">{deletingJob?.target_domain}</strong>? This will permanently delete all associated findings, endpoints, and data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingJob(null)}
              className="text-neutral-300 border-neutral-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingJob) {
                  deleteScan.mutate(deletingJob.id)
                  setDeletingJob(null)
                }
              }}
              disabled={deleteScan.isPending}
              className="gap-2"
            >
              <Trash className="h-4 w-4" />
              {deleteScan.isPending ? 'Deleting...' : 'Delete Scan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
