import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Scan,
  Globe,
  Shield,
  ArrowRight,
  Pulse,
  Bug,
} from '@phosphor-icons/react'
import { dashboardApi } from '@/services/api'
import type { DashboardData } from '@/types'

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  active,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  trend?: string
  active?: boolean
}) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 hover:bg-neutral-900/80 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</span>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${active ? 'bg-primary/10' : 'bg-neutral-800/50'}`}>
          <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-neutral-400'}`} />
        </div>
      </div>
      <div className="text-2xl font-bold text-neutral-100">{value}</div>
      {trend && <p className="text-xs text-neutral-500 mt-1">{trend}</p>}
    </div>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-neutral-700',
    high: 'bg-neutral-600',
    medium: 'bg-neutral-600',
    low: 'bg-primary/50',
    info: 'bg-neutral-500',
  }
  return <span className={`inline-block h-2 w-2 rounded-lg ${colors[severity] || 'bg-neutral-500'}`} />
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-neutral-800/50 text-neutral-300 border-neutral-700/50',
    high: 'bg-neutral-600/10 text-neutral-300 border-orange-800/50',
    medium: 'bg-neutral-600/10 text-neutral-300 border-amber-800/50',
    low: 'bg-primary/10 text-primary border-primary/50',
    info: 'bg-neutral-800 text-neutral-400 border-neutral-700',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${styles[severity] || styles.info}`}>
      {severity}
    </span>
  )
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function RiskBar({ label, count, max }: { label: string; count: number; max: number }) {
  const colors: Record<string, string> = {
    critical: 'bg-neutral-700',
    high: 'bg-neutral-600',
    medium: 'bg-neutral-600',
    low: 'bg-primary/50',
    info: 'bg-neutral-500',
  }
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <div className="flex items-center gap-2">
          <SeverityDot severity={label} />
          <span className="text-neutral-300 capitalize">{label}</span>
        </div>
        <span className="text-neutral-400">{count}</span>
      </div>
      <div className="h-1.5 bg-neutral-800 rounded-lg overflow-hidden">
        <div className={`h-full ${colors[label]} rounded-lg transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 bg-neutral-800 rounded-lg overflow-hidden">
      <div
        className={`h-full rounded-lg transition-all ${color || 'bg-primary'}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  )
}

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get(),
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div>
          <div className="h-8 w-48 bg-neutral-800 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-72 bg-neutral-800/50 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
              <div className="h-8 w-24 bg-neutral-800 rounded animate-pulse mb-3" />
              <div className="h-7 w-16 bg-neutral-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const d = data as DashboardData | undefined
  const activeCount = (d?.scans.running || 0) + (d?.scans.queued || 0)
  const severities = ['critical', 'high', 'medium', 'low', 'info']
  const maxSeverity = Math.max(
    ...severities.map((s) => d?.vulnerabilities.by_severity[s] || 0),
    1,
  )

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-light text-neutral-50">Dashboard</h1>
        <p className="text-neutral-400 text-sm mt-1">Your attack surface overview at a glance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Pulse}
          label="Active Scans"
          value={activeCount}
          trend={`${d?.scans.running || 0} running, ${d?.scans.queued || 0} queued`}
          active
        />
        <StatCard
          icon={Bug}
          label="Total Findings"
          value={d?.vulnerabilities.total || 0}
          trend={`${d?.scans.completed || 0} completed scans`}
        />
        <StatCard
          icon={Globe}
          label="Endpoints"
          value={(d?.assets.total_endpoints || 0).toLocaleString()}
          trend={`${d?.assets.total_subdomains || 0} subdomains`}
        />
        <StatCard
          icon={Shield}
          label="Vulnerabilities"
          value={(d?.vulnerabilities.total || 0).toLocaleString()}
          trend={`${d?.vulnerabilities.by_severity.high || 0} high, ${d?.vulnerabilities.by_severity.critical || 0} critical`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Findings */}
        <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-100">Recent Findings</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Latest discovered vulnerabilities</p>
            </div>
          </div>
          <div>
            {!d?.recent_findings || d.recent_findings.length === 0 ? (
              <div className="p-10 text-center">
                <Shield className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No findings yet. Start a scan to discover vulnerabilities.</p>
              </div>
            ) : (
              d.recent_findings.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-neutral-800/30 transition-colors border-b border-neutral-800/50 last:border-0"
                >
                  <div className="h-8 w-8 rounded-lg bg-neutral-800/50 flex items-center justify-center shrink-0">
                    <Bug className="h-4 w-4 text-neutral-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-200 truncate">{f.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{f.url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-xs text-neutral-500">{timeAgo(f.discovered_at)}</span>
                  </div>
                </div>
              ))
            )}
            {(d?.recent_findings?.length || 0) > 0 && (
              <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  Showing {d?.recent_findings.length} findings
                </span>
                <Link
                  to="/findings"
                  className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Risk Overview */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
            <h2 className="text-base font-semibold text-neutral-100 mb-4">Risk Overview</h2>
            <div className="space-y-3">
              {severities.map((sev) => (
                <RiskBar
                  key={sev}
                  label={sev}
                  count={d?.vulnerabilities.by_severity[sev] || 0}
                  max={maxSeverity}
                />
              ))}
            </div>
            {d && (
              <div className="mt-4 pt-4 border-t border-neutral-800">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total</span>
                  <span className="font-medium text-neutral-200">{d.vulnerabilities.total} findings</span>
                </div>
              </div>
            )}
          </div>

          {/* Active Scans */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
            <h2 className="text-base font-semibold text-neutral-100 mb-4">Active Scans</h2>
            {!d?.active_scans || d.active_scans.length === 0 ? (
              <div className="py-6 text-center">
                <Scan className="h-6 w-6 text-neutral-700 mx-auto mb-2" />
                <p className="text-xs text-neutral-500">No active scans</p>
              </div>
            ) : (
              <div className="space-y-4">
                {d.active_scans.map((s) => (
                  <div key={s.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <Link
                        to={`/scans/${s.id}`}
                        className="font-medium text-neutral-200 hover:text-primary transition-colors truncate"
                      >
                        {s.target_domain}
                      </Link>
                      <span className="text-neutral-500 text-xs">{Math.round(s.progress_percent)}%</span>
                    </div>
                    <ProgressBar value={s.progress_percent} color={s.progress_percent < 50 ? 'bg-neutral-600' : undefined} />
                    {s.current_stage && (
                      <p className="text-xs text-neutral-500 mt-1">{s.current_stage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(d?.scans.running || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-800">
                <Link
                  to="/scans"
                  className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                >
                  View all scans <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
