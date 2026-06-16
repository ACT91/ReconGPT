import { Shield, Globe, AlertTriangle, ArrowRight, ScanLine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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

function StatCard({ icon: Icon, label, value, trend }: { icon: React.ElementType; label: string; value: string; trend?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">{trend}</p>
        )}
      </CardContent>
    </Card>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { variant: 'destructive' | 'warning' | 'info' | 'secondary'; label: string }> = {
    critical: { variant: 'destructive', label: 'Critical' },
    high: { variant: 'warning', label: 'High' },
    medium: { variant: 'info', label: 'Medium' },
    low: { variant: 'secondary', label: 'Low' },
  }
  const { variant, label } = map[severity] || { variant: 'secondary' as const, label: severity }
  return <Badge variant={variant}>{label}</Badge>
}

const recentFindings = [
  { title: 'XSS Vulnerability', severity: 'high', endpoint: '/api/search', time: '2m ago' },
  { title: 'Open Redirect', severity: 'medium', endpoint: '/login', time: '15m ago' },
  { title: 'Info Disclosure', severity: 'low', endpoint: '/debug', time: '1h ago' },
  { title: 'SQL Injection', severity: 'critical', endpoint: '/api/users', time: '3h ago' },
]

const riskData = [
  { label: 'Critical', count: 2, pct: 15, color: 'bg-destructive' },
  { label: 'High', count: 12, pct: 45, color: 'bg-orange-500' },
  { label: 'Medium', count: 28, pct: 60, color: 'bg-amber-500' },
  { label: 'Low', count: 205, pct: 90, color: 'bg-primary/40' },
]

export function Dashboard() {
  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your attack surface overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ScanLine} label="Active Scans" value="3" trend="2 running, 1 queued" />
        <StatCard icon={AlertTriangle} label="Total Findings" value="247" trend="+18 in last 24h" />
        <StatCard icon={Globe} label="Endpoints" value="1,432" trend="Across 5 targets" />
        <StatCard icon={Shield} label="Vulnerabilities" value="42" trend="12 high, 2 critical" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Findings</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Last 24 hours</p>
            </div>
            <Badge variant="default" className="text-xs">18 new</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentFindings.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.endpoint}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-xs text-muted-foreground">{f.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Showing 4 of 18 findings</span>
              <button className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Risk Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {riskData.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.count}</span>
                  </div>
                  <Progress value={item.pct} className="h-2" />
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">247 findings</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Active Scans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">example.com</span>
                  <span className="text-muted-foreground">62%</span>
                </div>
                <Progress value={62} className="h-2 [&>div]:bg-yellow-500" />
                <p className="text-xs text-muted-foreground mt-1">Stage 8/13 — Endpoint Extraction</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">testsite.io</span>
                  <span className="text-muted-foreground">23%</span>
                </div>
                <Progress value={23} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">Stage 3/13 — Tech Detection</p>
              </div>
              <div className="pt-2 border-t">
                <button className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1">
                  View all scans <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attack Surface Map</CardTitle>
          <p className="text-sm text-muted-foreground">Visual representation of your attack surface</p>
        </CardHeader>
        <CardContent>
          <AttackSurfaceGraph scanId="demo-scan" data={mockScanData} />
        </CardContent>
      </Card>
    </div>
  )
}
