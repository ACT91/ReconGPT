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
import { scanApi, getApiError } from '@/services/api'
import { useScanWebSocket } from '@/hooks/useScanWebSocket'
import { ScanProgressBar, StatusBadge, LiveLogsViewer, SkeletonTable, ErrorBoundary } from '@/components/common'
import type { ScanJob, ScanProgress, ScanLogEntry } from '@/types'

const columnHelper = createColumnHelper<ScanJob>()

function NewScanModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [targetDomain, setTargetDomain] = useState('')
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const startScan = useMutation({
    mutationFn: scanApi.start,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      onClose()
      setTargetDomain('')
    },
    onError: (err) => setError(getApiError(err)),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-white mb-4">New Scan</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">{error}</div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            startScan.mutate({ target_domain: targetDomain })
          }}
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Target Domain</label>
            <input
              type="text"
              value={targetDomain}
              onChange={(e) => setTargetDomain(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example.com"
              required
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-300 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={startScan.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
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
        setTimeout(() => onClose(), 3000)
      }
    },
  })

  const displayProgress = progressData || progress
  const displayLogs = logsData?.items || logs

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{job.target_domain}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={job.status} />
              <span className="text-sm text-gray-400">Started {new Date(job.created_at).toLocaleString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'progress' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
          >
            Progress
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'logs' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
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
                  <div key={stage.stage} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300 truncate">{stage.stage.replace(/\d+_/, '').replace(/_/g, ' ')}</span>
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

        {job.status === 'running' && (
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={async () => {
                try {
                  await scanApi.cancel(job.id)
                } catch {}
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
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

  const { data: scansData, isLoading } = useQuery({
    queryKey: ['scans', pagination, sorting, globalFilter],
    queryFn: () =>
      scanApi.list({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort: sorting.length > 0 ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : undefined,
        search: globalFilter || undefined,
      }),
  })

  const queryClient = useQueryClient()
  const cancelScan = useMutation({
    mutationFn: (jobId: string) => scanApi.cancel(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scans'] }),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor('target_domain', {
        header: 'Target',
        cell: (info) => <span className="font-medium text-white">{info.getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('current_stage', {
        header: 'Current Stage',
        cell: (info) => (
          <span className="text-sm text-gray-400">
            {info.getValue() ? info.getValue()!.replace(/\d+_/, '').replace(/_/g, ' ') : '—'}
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
          <span className="text-sm text-gray-400">{new Date(info.getValue()).toLocaleDateString()}</span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedJob(row.original)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View
            </button>
            {(row.original.status === 'running' || row.original.status === 'queued') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  cancelScan.mutate(row.original.id)
                }}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Cancel
              </button>
            )}
          </div>
        ),
      }),
    ],
    [cancelScan]
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
          <h1 className="text-3xl font-light text-white">Scans</h1>
          <p className="text-gray-400 text-sm mt-1">Manage and monitor your reconnaissance scans</p>
        </div>
        <button
          onClick={() => setShowNewScan(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
        >
          + New Scan
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search scans..."
          className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <ErrorBoundary>
      {isLoading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <SkeletonTable rows={6} cols={6} />
        </div>
      ) : (
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-gray-400">
                    No scans yet. Start your first scan!
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={() => setSelectedJob(row.original)}
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

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <span className="text-sm text-gray-400">
            Page {pagination.pageIndex + 1} of {scansData ? Math.max(1, Math.ceil(scansData.total / pagination.pageSize)) : 1} ({scansData?.total || 0} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 disabled:opacity-50"
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