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
import { useParams } from 'react-router-dom'
import { scanApi } from '@/services/api'
import { TechnologyBadges } from '@/components/common'
import type { Subdomain } from '@/types'

const columnHelper = createColumnHelper<Subdomain>()

export function AssetsPage() {
  const { scanId } = useParams<{ scanId: string }>()
  const [jobId, setJobId] = useState(scanId || '')
  const [inputJobId, setInputJobId] = useState(scanId || '')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [filterAlive, setFilterAlive] = useState<'all' | 'alive' | 'dead'>('all')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  const { data, isLoading } = useQuery({
    queryKey: ['subdomains', jobId, pagination, sorting, filterAlive],
    queryFn: () =>
      scanApi.getSubdomains(jobId, {
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        sort: sorting.length > 0 ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : undefined,
      }),
    enabled: !!jobId,
  })

  const filteredData = useMemo(() => {
    if (!data?.items) return []
    if (filterAlive === 'all') return data.items
    return data.items.filter((s) => (filterAlive === 'alive' ? s.is_alive : !s.is_alive))
  }, [data, filterAlive])

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Domain',
        cell: (info) => <span className="font-medium text-white">{info.getValue()}</span>,
      }),
      columnHelper.accessor('is_alive', {
        header: 'Status',
        cell: (info) => (
          <span className={`inline-flex items-center gap-1 text-xs ${info.getValue() ? 'text-green-400' : 'text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full ${info.getValue() ? 'bg-green-400' : 'bg-gray-600'}`} />
            {info.getValue() ? 'Live' : 'Dead'}
          </span>
        ),
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => <span className="text-sm text-gray-400 truncate max-w-[200px] block">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('status_code', {
        header: 'Status',
        cell: (info) => <span className="text-sm text-gray-400">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('web_server', {
        header: 'Web Server',
        cell: (info) => <span className="text-sm text-gray-400">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('technologies', {
        header: 'Technologies',
        cell: (info) => <TechnologyBadges technologies={info.getValue()} />,
      }),
      columnHelper.accessor('ips', {
        header: 'IPs',
        cell: (info) => (
          <span className="text-sm text-gray-400">{(info.getValue() || []).join(', ') || '—'}</span>
        ),
      }),
    ],
    []
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

  const handleExport = () => {
    if (!data?.items) return
    const csv = [
      'Domain,Status,Title,Status Code,Web Server,Technologies,IPs',
      ...data.items.map((s) =>
        [
          s.name,
          s.is_alive ? 'Live' : 'Dead',
          s.title || '',
          s.status_code || '',
          s.web_server || '',
          (s.technologies || []).join('; '),
          (s.ips || []).join('; '),
        ].join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assets-${jobId || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-light text-white">Assets</h1>
          <p className="text-gray-400 text-sm mt-1">Discovered subdomains and hosts</p>
        </div>
        {data?.items && (
          <button onClick={handleExport} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
            Export CSV
          </button>
        )}
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
          Load Assets
        </button>
        <div className="flex gap-2 ml-4">
          {(['all', 'alive', 'dead'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterAlive(f)}
              className={`px-3 py-2 rounded-lg text-sm ${
                filterAlive === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'alive' ? 'Live Only' : 'Dead Only'}
            </button>
          ))}
        </div>
      </div>

      {!jobId ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">Enter a scan job ID to view its assets</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-20 text-gray-400">Loading assets...</div>
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
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
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
            <span className="text-sm text-gray-400">{data?.total || 0} total assets</span>
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
      )}
    </div>
  )
}