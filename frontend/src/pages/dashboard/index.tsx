import { Activity, Shield, TrendingUp } from 'lucide-react'
import { AttackSurfaceGraph } from '@/graphs/AttackSurfaceGraph'

const mockScanData = {
  domain: 'example.com',
  subdomains: ['api.example.com', 'admin.example.com', 'cdn.example.com', 'dev.example.com', 'staging.example.com'],
  liveHosts: ['api.example.com', 'cdn.example.com', 'dev.example.com'],
  technologies: {
    'api.example.com': ['nginx', 'node.js'],
    'admin.example.com': ['apache', 'php'],
  },
  jsFiles: ['app.js', 'vendor.js', 'config.js', 'api-client.js'],
  endpoints: ['/api/v1/users', '/api/v1/auth', '/admin/login', '/api/v1/settings'],
  vulnerabilities: [
    { endpoint: '/admin/login', severity: 'high' },
    { endpoint: '/api/v1/users', severity: 'medium' },
  ],
}

export function Dashboard() {
  return (
    <div>
      {/* Header */}
      <header className="mb-10 px-2 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-2">Dashboard</h1>
          <p className="text-brand-muted text-lg">Your attack surface overview</p>
        </div>

        {/* Stats */}
        <div className="flex gap-8 items-end">
          <div className="text-center">
            <div className="text-sm text-brand-muted flex items-center gap-1 justify-center mb-1">
              <Activity className="w-4 h-4" />
              Active Scans
            </div>
            <div className="text-4xl font-light">3</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-brand-muted flex items-center gap-1 justify-center mb-1">
              <Shield className="w-4 h-4" />
              Findings
            </div>
            <div className="text-4xl font-light">247</div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Scans Card */}
        <div className="card relative">
          <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-brand-muted hover:bg-gray-100 cursor-pointer">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="text-xl font-medium mb-1">Active Scans</h3>
          <p className="text-sm text-brand-muted mb-8">Currently running</p>
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-4xl font-light mb-1">3</div>
              <div className="text-xs text-brand-muted">In Progress</div>
            </div>
            <div className="badge-active">Running</div>
          </div>

          {/* Progress bars */}
          <div className="space-y-3 mt-8">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">example.com</span>
                <span className="text-brand-muted">Stage 8/13</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-yellow rounded-full" style={{ width: '62%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">testsite.io</span>
                <span className="text-brand-muted">Stage 3/13</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-dark rounded-full" style={{ width: '23%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Findings Card */}
        <div className="card-dark row-span-2">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-xl font-medium mb-1">Recent Findings</h3>
              <p className="text-sm text-gray-400">Last 24 hours</p>
            </div>
            <div className="text-3xl font-light text-brand-yellow">18</div>
          </div>

          <div className="space-y-4 flex-grow">
            {[
              { title: 'XSS Vulnerability', severity: 'high', endpoint: '/api/search' },
              { title: 'Open Redirect', severity: 'medium', endpoint: '/login' },
              { title: 'Info Disclosure', severity: 'low', endpoint: '/debug' },
            ].map((finding, i) => (
              <div key={i} className="flex items-center gap-4 group cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-brand-yellow transition-colors shrink-0">
                  <Shield className="w-4 h-4 text-white group-hover:text-brand-dark" />
                </div>
                <div className="flex-grow">
                  <h4 className="text-sm font-medium">{finding.title}</h4>
                  <p className="text-xs text-gray-400">{finding.endpoint}</p>
                </div>
                <div className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                  finding.severity === 'high' ? 'bg-red-500/20 text-red-300' :
                  finding.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-gray-500/20 text-gray-300'
                }`}>
                  {finding.severity}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
            <span className="text-sm text-gray-400">View All</span>
            <button className="text-brand-yellow hover:text-brand-yellow/80 transition-colors">→</button>
          </div>
        </div>

        {/* Risk Overview Card */}
        <div className="card">
          <h3 className="text-xl font-medium mb-6">Risk Overview</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium">Critical</span>
                <span className="text-brand-muted">2</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: '15%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium">High</span>
                <span className="text-brand-muted">12</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium">Medium</span>
                <span className="text-brand-muted">28</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium">Low</span>
                <span className="text-brand-muted">205</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-dark rounded-full" style={{ width: '90%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Attack Surface Graph - Full Width */}
        <div className="lg:col-span-3">
          <h3 className="text-2xl font-light mb-4">Attack Surface Map</h3>
          <AttackSurfaceGraph scanId="demo-scan" data={mockScanData} />
        </div>
      </main>
    </div>
  )
}
