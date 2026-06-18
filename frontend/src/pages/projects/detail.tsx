import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi, scanApi, getApiError } from '@/services/api'
import { ErrorBoundary, StatusBadge, ScanProgressBar } from '@/components/common'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Globe, Network, AlertTriangle, Target, Play } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ScanJob } from '@/types'

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-900/30 text-red-400',
    high: 'bg-orange-900/30 text-orange-400',
    medium: 'bg-yellow-900/30 text-yellow-400',
    low: 'bg-blue-900/30 text-blue-400',
    info: 'bg-zinc-800 text-zinc-400',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[severity] || colors.info}`}>
      {severity}
    </span>
  )
}

function NewScanModal({
  open,
  onClose,
  projectId,
  defaultDomain,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  defaultDomain?: string
}) {
  const [targetDomain, setTargetDomain] = useState(defaultDomain || '')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const [isStarting, setIsStarting] = useState(false)

  if (!open) return null

  const handleStart = async () => {
    if (!targetDomain.trim()) return
    setIsStarting(true)
    setError('')
    try {
      const result = await scanApi.start({ target_domain: targetDomain.trim(), project_id: projectId })
      toast.success(`Scan started for ${targetDomain}`)
      onClose()
      navigate(`/scans/${result.job_id}`)
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">New Scan for Project</h2>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">{error}</div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Target Domain</label>
          <input
            type="text"
            value={targetDomain}
            onChange={(e) => setTargetDomain(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sidebar-active/50"
            placeholder="example.com"
            required
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleStart}
            disabled={isStarting || !targetDomain.trim()}
            className="bg-sidebar-active text-sidebar-bg hover:bg-sidebar-active/90 gap-2"
          >
            <Play className="h-4 w-4" />
            {isStarting ? 'Starting...' : 'Start Scan'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [showNewScan, setShowNewScan] = useState(false)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: stats } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => projectApi.getStats(projectId!),
    enabled: !!projectId,
  })

  const { data: scansData, isLoading: scansLoading } = useQuery({
    queryKey: ['project-scans', projectId],
    queryFn: () => scanApi.list({ project_id: projectId, page_size: 50 }),
    enabled: !!projectId,
  })

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading project...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400">Project not found</p>
        <Button onClick={() => navigate('/projects')} variant="ghost" className="mt-4 text-zinc-400">
          Back to Projects
        </Button>
      </div>
    )
  }

  const scans = scansData?.items || []

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
        <Link to="/projects" className="hover:text-zinc-300 transition-colors">
          Projects
        </Link>
        <span>/</span>
        <span className="text-zinc-300">{project.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-zinc-500 mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <Button
          onClick={() => setShowNewScan(true)}
          className="bg-sidebar-active text-sidebar-bg hover:bg-sidebar-active/90 gap-2"
        >
          <Play className="h-4 w-4" />
          New Scan
        </Button>
      </div>

      {project.target_domains && project.target_domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {project.target_domains.map((domain: string) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-zinc-800 text-zinc-400"
            >
              <Target className="h-3 w-3" />
              {domain}
            </span>
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-semibold text-zinc-100">{stats.total_scans}</p>
            <p className="text-xs text-zinc-500 mt-1">Total Scans</p>
            <div className="flex gap-2 mt-2 text-[11px]">
              <span className="text-green-400">{stats.completed_scans} done</span>
              <span className="text-red-400">{stats.failed_scans} failed</span>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-semibold text-zinc-100">{stats.total_subdomains}</p>
            <p className="text-xs text-zinc-500 mt-1">
              <Globe className="h-3 w-3 inline mr-1" />
              Subdomains
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-semibold text-zinc-100">{stats.total_endpoints}</p>
            <p className="text-xs text-zinc-500 mt-1">
              <Network className="h-3 w-3 inline mr-1" />
              Endpoints
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-semibold text-zinc-100">{stats.total_vulnerabilities}</p>
            <p className="text-xs text-zinc-500 mt-1">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              Vulnerabilities
            </p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {stats.critical_vulns > 0 && <SeverityBadge severity="critical" />}
              {stats.high_vulns > 0 && <SeverityBadge severity="high" />}
              {stats.medium_vulns > 0 && <SeverityBadge severity="medium" />}
              {stats.low_vulns > 0 && <SeverityBadge severity="low" />}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">Scans</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          {scans.length} scan{scans.length !== 1 ? 's' : ''} for this project
        </p>
      </div>

      <ErrorBoundary>
        {scansLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-zinc-800 rounded w-1/3 mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : scans.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800/50 rounded-xl">
            <Play className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400">No scans yet</p>
            <p className="text-sm text-zinc-600 mt-1">Start a scan for this project</p>
            <Button
              onClick={() => setShowNewScan(true)}
              className="mt-4 bg-sidebar-active text-sidebar-bg hover:bg-sidebar-active/90 gap-2"
            >
              <Play className="h-4 w-4" />
              Start Scan
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map((scan: ScanJob) => (
              <div
                key={scan.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors cursor-pointer"
                onClick={() => navigate(`/scans/${scan.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-medium text-zinc-100 text-sm">{scan.target_domain}</h3>
                    <StatusBadge status={scan.status} />
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(scan.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  {scan.current_stage && (
                    <span>
                      Stage: {scan.current_stage.replace(/\d+_/, '').replace(/_/g, ' ')}
                    </span>
                  )}
                  <ScanProgressBar progress={scan.progress_percent} status={scan.status} size="sm" showLabel />
                </div>
              </div>
            ))}
          </div>
        )}
      </ErrorBoundary>

      <NewScanModal
        open={showNewScan}
        onClose={() => setShowNewScan(false)}
        projectId={projectId!}
        defaultDomain={project.target_domains?.[0]}
      />
    </div>
  )
}
