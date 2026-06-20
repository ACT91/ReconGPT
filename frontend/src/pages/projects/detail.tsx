import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi, scanApi, getApiError } from '@/services/api'
import { ErrorBoundary, StatusBadge, ScanProgressBar } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { ArrowLeft, Globe, Network, WarningCircle, Crosshair, Play } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import type { ScanJob } from '@/types'

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-neutral-800/50 text-neutral-300',
    high: 'bg-neutral-600/10 text-neutral-300',
    medium: 'bg-neutral-600/10 text-neutral-300',
    low: 'bg-primary/10 text-primary',
    info: 'bg-neutral-800 text-neutral-400',
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
  const [runVulnScan, setRunVulnScan] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const [isStarting, setIsStarting] = useState(false)

  const handleStart = async () => {
    if (!targetDomain.trim()) return
    setIsStarting(true)
    setError('')
    try {
      const result = await scanApi.start({
        target_domain: targetDomain.trim(),
        project_id: projectId,
        scan_config: { vuln_scan: runVulnScan },
      })
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New Scan for Project</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-domain-project">Target Domain</Label>
            <Input
              id="target-domain-project"
              type="text"
              value={targetDomain}
              onChange={(e) => setTargetDomain(e.target.value)}
              placeholder="example.com"
              required
            />
          </div>

          <Checkbox
            id="run-vuln-scan-project"
            checked={runVulnScan}
            onChange={(e) => setRunVulnScan(e.target.checked)}
            label="Run vulnerability scan (takes longer)"
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={isStarting || !targetDomain.trim()}>
              <Play className="h-4 w-4 mr-1" />
              {isStarting ? 'Starting...' : 'Start Scan'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
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
        <div className="text-neutral-500">Loading project...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-400">Project not found</p>
        <Button onClick={() => navigate('/projects')} variant="ghost" className="mt-4 text-neutral-400">
          Back to Projects
        </Button>
      </div>
    )
  }

  const scans = scansData?.items || []

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <Link to="/projects" className="hover:text-neutral-300 transition-colors">
          Projects
        </Link>
        <span>/</span>
        <span className="text-neutral-300">{project.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-100">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-neutral-500 mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <Button
          onClick={() => setShowNewScan(true)}
          className="bg-primary text-sidebar-bg hover:bg-primary/90/90 gap-2"
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
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-neutral-800 text-neutral-400"
            >
              <Crosshair className="h-3 w-3" />
              {domain}
            </span>
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <p className="text-2xl font-semibold text-neutral-100">{stats.total_scans}</p>
            <p className="text-xs text-neutral-500 mt-1">Total Scans</p>
            <div className="flex gap-2 mt-2 text-[11px]">
              <span className="text-neutral-300">{stats.completed_scans} done</span>
              <span className="text-neutral-300">{stats.failed_scans} failed</span>
            </div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <p className="text-2xl font-semibold text-neutral-100">{stats.total_subdomains}</p>
            <p className="text-xs text-neutral-500 mt-1">
              <Globe className="h-3 w-3 inline mr-1" />
              Subdomains
            </p>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <p className="text-2xl font-semibold text-neutral-100">{stats.total_endpoints}</p>
            <p className="text-xs text-neutral-500 mt-1">
              <Network className="h-3 w-3 inline mr-1" />
              Endpoints
            </p>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <p className="text-2xl font-semibold text-neutral-100">{stats.total_vulnerabilities}</p>
            <p className="text-xs text-neutral-500 mt-1">
              <WarningCircle className="h-3 w-3 inline mr-1" />
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
        <h2 className="text-lg font-semibold text-neutral-100">Scans</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          {scans.length} scan{scans.length !== 1 ? 's' : ''} for this project
        </p>
      </div>

      <ErrorBoundary>
        {scansLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 animate-pulse">
                <div className="h-5 bg-neutral-800 rounded w-1/3 mb-2" />
                <div className="h-3 bg-neutral-800 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : scans.length === 0 ? (
          <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-lg">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Play className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>No scans yet</EmptyTitle>
                <EmptyDescription>Start a scan for this project to discover assets and vulnerabilities.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setShowNewScan(true)} className="bg-primary text-sidebar-bg hover:bg-primary/90 gap-2">
                  <Play className="h-4 w-4" />
                  Start Scan
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map((scan: ScanJob) => (
              <div
                key={scan.id}
                className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 transition-colors cursor-pointer"
                onClick={() => navigate(`/scans/${scan.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-medium text-neutral-100 text-sm">{scan.target_domain}</h3>
                    <StatusBadge status={scan.status} />
                  </div>
                  <span className="text-xs text-neutral-500">
                    {new Date(scan.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-500">
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
