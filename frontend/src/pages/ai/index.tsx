import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { insightApi, resultApi } from '@/services/api'
import { SeverityBadge } from '@/components/common'
import type { AggregatedStats } from '@/types'

function RiskScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 70) return 'text-red-400'
    if (s >= 40) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getLabel = (s: number) => {
    if (s >= 70) return 'High Risk'
    if (s >= 40) return 'Medium Risk'
    return 'Low Risk'
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32 mb-3">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f2937" strokeWidth="2.8" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeDasharray={`${score}, 100`}
            className={getColor(score)}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${getColor(score)}`}>{Math.round(score)}</span>
        </div>
      </div>
      <span className={`text-sm font-medium ${getColor(score)}`}>{getLabel(score)}</span>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
    </div>
  )
}

function VsSeverityChart({ stats }: { stats: AggregatedStats }) {
  const severities = [
    { key: 'critical', label: 'Critical', color: 'bg-red-500' },
    { key: 'high', label: 'High', color: 'bg-orange-500' },
    { key: 'medium', label: 'Medium', color: 'bg-yellow-500' },
    { key: 'low', label: 'Low', color: 'bg-blue-500' },
    { key: 'info', label: 'Info', color: 'bg-gray-500' },
  ]

  const maxVal = Math.max(
    ...severities.map((s) => stats.vulnerabilities_by_severity[s.key] || 0),
    1
  )

  return (
    <div className="space-y-2">
      {severities.map((s) => {
        const val = stats.vulnerabilities_by_severity[s.key] || 0
        const pct = (val / maxVal) * 100
        return (
          <div key={s.key}>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{s.label}</span>
              <span>{val}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AIAnalysisPage() {
  const [jobId, setJobId] = useState('')
  const [inputJobId, setInputJobId] = useState('')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['ai-summary', jobId],
    queryFn: () => insightApi.executiveSummary(jobId),
    enabled: !!jobId,
    retry: false,
  })

  const { data: riskScore } = useQuery({
    queryKey: ['ai-risk-score', jobId],
    queryFn: () => insightApi.riskScore(jobId),
    enabled: !!jobId,
    retry: false,
  })

  const { data: insights } = useQuery({
    queryKey: ['ai-insights', jobId],
    queryFn: () => insightApi.list(jobId, { page_size: 50 }),
    enabled: !!jobId,
  })

  const { data: stats } = useQuery({
    queryKey: ['result-stats', jobId],
    queryFn: () => resultApi.getStats(jobId),
    enabled: !!jobId,
    retry: false,
  })

  const { data: attackVectors } = useQuery({
    queryKey: ['ai-vectors', jobId],
    queryFn: () => insightApi.attackVectors(jobId),
    enabled: !!jobId,
    retry: false,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-light text-white">AI Analysis</h1>
          <p className="text-gray-400 text-sm mt-1">Automated intelligence and risk assessment</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
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
          Load Analysis
        </button>
      </div>

      {!jobId ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">Enter a scan job ID to view AI analysis</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Risk Score + Stats Row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-center">
              <RiskScoreGauge score={(riskScore as any)?.overall_score || 0} />
            </div>
            <div className="lg:col-span-3 grid grid-cols-3 gap-4">
              <StatCard label="Subdomains" value={stats?.total_subdomains || 0} color="text-blue-400" />
              <StatCard label="Live Hosts" value={stats?.live_subdomains || 0} color="text-green-400" />
              <StatCard label="Endpoints" value={stats?.total_endpoints || 0} color="text-purple-400" />
              <StatCard label="Vulnerabilities" value={stats?.total_vulnerabilities || 0} color="text-red-400" />
              <StatCard label="Critical" value={stats?.vulnerabilities_by_severity?.critical || 0} color="text-red-500" />
              <StatCard label="High" value={stats?.vulnerabilities_by_severity?.high || 0} color="text-orange-400" />
            </div>
          </div>

          {/* Vulnerabilities by Severity */}
          {stats && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Vulnerabilities by Severity</h2>
              <VsSeverityChart stats={stats} />
            </div>
          )}

          {/* Executive Summary */}
          {summaryLoading ? (
            <div className="text-center py-8 text-gray-400">Loading summary...</div>
          ) : summary ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Executive Summary</h2>
              <div className="prose prose-invert max-w-none">
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {(summary as any).content || summary.summary || 'No summary available'}
                </p>
              </div>
            </div>
          ) : null}

          {/* Prioritized Recommendations / Attack Vectors */}
          {attackVectors && Array.isArray(attackVectors) && attackVectors.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Prioritized Recommendations</h2>
              <div className="space-y-3">
                {attackVectors.map((v: any) => (
                  <div key={v.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white">{v.title}</h3>
                      <SeverityBadge severity={v.priority} />
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2">{v.summary}</p>
                    {v.affected_assets && v.affected_assets.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {v.affected_assets.slice(0, 5).map((asset: string) => (
                          <span key={asset} className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">
                            {asset}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Insights */}
          {insights?.items && insights.items.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">All AI Insights ({insights.total})</h2>
              <div className="space-y-2">
                {insights.items.map((insight) => (
                  <div key={insight.id} className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 uppercase">{insight.type}</span>
                      <SeverityBadge severity={insight.priority} />
                      {insight.is_actionable && (
                        <span className="text-xs text-blue-400">Actionable</span>
                      )}
                    </div>
                    <p className="text-sm text-white">{insight.title}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{insight.summary || insight.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}