import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { resultApi, scanApi, getApiError } from '@/services/api'
import { ErrorBoundary, Skeleton, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { FileText, Download, FileCode, FileXls, MagnifyingGlass } from '@phosphor-icons/react'
import toast from 'react-hot-toast'

function ReportPreview({ jobId }: { jobId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['report-full', jobId],
    queryFn: () => resultApi.getFull(jobId),
    enabled: !!jobId,
    retry: false,
  })

  const { data: job } = useQuery({
    queryKey: ['scan-job', jobId],
    queryFn: () => scanApi.get(jobId),
    enabled: !!jobId,
  })

  if (isLoading) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
        <div className="space-y-4">
          <Skeleton variant="text" width={200} height={24} />
          <Skeleton variant="text" count={4} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-neutral-400">
        <p>Failed to load report data</p>
        <p className="text-sm text-neutral-600 mt-1">{getApiError(error)}</p>
      </div>
    )
  }

  const stats = data?.aggregated_stats
  const severityCounts = stats?.vulnerabilities_by_severity || {}

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reconny-report-${jobId}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('JSON report downloaded')
  }

  const handleExportCSV = () => {
    if (!data?.vulnerabilities || data.vulnerabilities.length === 0) {
      toast.error('No vulnerabilities to export')
      return
    }
    const csv = [
      'Severity,Name,Template ID,URL,Description,CVSS',
      ...data.vulnerabilities.map((v: any) =>
        [
          v.severity,
          `"${(v.name || '').replace(/"/g, '""')}"`,
          v.template_id || '',
          v.url || '',
          `"${(v.description || '').replace(/"/g, '""')}"`,
          v.cvss_score || '',
        ].join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reconny-findings-${jobId}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV report downloaded')
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="p-6 border-b border-neutral-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">
                Scan Report: {job?.target_domain || jobId}
              </h2>
              {job && (
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={job.status} />
                  <span className="text-xs text-neutral-500">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportJSON}
              variant="outline"
              className="border-neutral-700 text-neutral-300 hover:text-neutral-100 gap-2"
              size="sm"
            >
              <FileCode className="h-4 w-4" />
              JSON
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="border-neutral-700 text-neutral-300 hover:text-neutral-100 gap-2"
              size="sm"
            >
              <FileXls className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-neutral-800/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-neutral-100">{data?.total_subdomains || 0}</p>
            <p className="text-xs text-neutral-500 mt-0.5">Subdomains</p>
          </div>
          <div className="bg-neutral-800/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-neutral-100">{data?.total_endpoints || 0}</p>
            <p className="text-xs text-neutral-500 mt-0.5">Endpoints</p>
          </div>
          <div className="bg-neutral-800/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-neutral-100">{data?.total_vulnerabilities || 0}</p>
            <p className="text-xs text-neutral-500 mt-0.5">Findings</p>
          </div>
          <div className="bg-neutral-800/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-neutral-100">
              {Object.values(severityCounts as Record<string, number>).reduce((a: number, b: number) => a + b, 0)}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">Total Issues</p>
          </div>
        </div>

        {/* Severity Breakdown */}
        {stats && (
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-3">Severity Breakdown</h3>
            <div className="space-y-2">
              {[
                { key: 'critical', label: 'Critical', color: 'bg-neutral-700' },
                { key: 'high', label: 'High', color: 'bg-neutral-600' },
                { key: 'medium', label: 'Medium', color: 'bg-neutral-600' },
                { key: 'low', label: 'Low', color: 'bg-primary' },
                { key: 'info', label: 'Info', color: 'bg-neutral-500' },
              ].map((s) => {
                const val = (severityCounts as Record<string, number>)[s.key] || 0
                const maxVal = Math.max(
                  ...Object.values(severityCounts as Record<string, number>),
                  1,
                )
                return (
                  <div key={s.key}>
                    <div className="flex justify-between text-xs text-neutral-400 mb-1">
                      <span>{s.label}</span>
                      <span>{val}</span>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-lg overflow-hidden">
                      <div
                        className={`h-full ${s.color} rounded-lg transition-all`}
                        style={{ width: `${(val / maxVal) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Vulnerabilities List */}
        {data?.vulnerabilities && data.vulnerabilities.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-3">
              Findings ({data.vulnerabilities.length})
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.vulnerabilities.map((v: any) => (
                <div
                  key={v.id}
                  className="flex items-start gap-2 p-3 rounded-lg bg-neutral-800/20 border border-neutral-800/50"
                >
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      v.severity === 'critical'
                        ? 'bg-red-900/40 text-neutral-300'
                        : v.severity === 'high'
                        ? 'bg-neutral-600/10 text-neutral-300'
                        : v.severity === 'medium'
                        ? 'bg-neutral-600/10 text-neutral-300'
                        : v.severity === 'low'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {v.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-200 font-medium truncate">{v.name}</p>
                    <p className="text-xs text-neutral-500 truncate mt-0.5 font-mono">{v.url}</p>
                  </div>
                  {v.cvss_score && (
                    <span className="text-xs text-neutral-500 font-mono">{v.cvss_score}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subdomains */}
        {data?.subdomains && data.subdomains.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-3">
              Subdomains ({data.subdomains.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.subdomains.slice(0, 20).map((s: any) => (
                <span
                  key={s.id}
                  className={`px-2 py-0.5 rounded text-xs ${
                    s.is_alive
                      ? 'bg-green-900/20 text-neutral-300 border border-green-900/30'
                      : 'bg-neutral-800/50 text-neutral-500'
                  }`}
                >
                  {s.name}
                </span>
              ))}
              {data.subdomains.length > 20 && (
                <span className="text-xs text-neutral-500 px-2 py-0.5">
                  +{data.subdomains.length - 20} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ReportsPage() {
  const { scanId } = useParams<{ scanId: string }>()
  const [jobId, setJobId] = useState(scanId || '')
  const [inputJobId, setInputJobId] = useState(scanId || '')

  // Auto-load when scanId is in URL
  useEffect(() => {
    if (scanId && scanId !== jobId) {
      setJobId(scanId)
      setInputJobId(scanId)
    }
  }, [scanId])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Reports</h1>
          <p className="text-sm text-neutral-400 mt-1">Generate and export scan reports</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            value={inputJobId}
            onChange={(e) => setInputJobId(e.target.value)}
            placeholder="Enter scan job ID..."
            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg pl-10 pr-4 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <Button
          onClick={() => setJobId(inputJobId)}
          disabled={!inputJobId.trim()}
          className="bg-primary text-sidebar-bg hover:bg-primary/90/90 gap-2"
        >
          <Download className="h-4 w-4" />
          Generate Report
        </Button>
      </div>

      {!jobId ? (
        <div className="text-center py-20">
          <FileText className="h-12 w-12 text-neutral-700 mx-auto mb-4" />
          <p className="text-lg text-neutral-400">Enter a scan job ID</p>
          <p className="text-sm text-neutral-600 mt-1">
            Generate a comprehensive report from a completed scan
          </p>
        </div>
      ) : (
        <ErrorBoundary>
          <ReportPreview jobId={jobId} />
        </ErrorBoundary>
      )}
    </div>
  )
}
