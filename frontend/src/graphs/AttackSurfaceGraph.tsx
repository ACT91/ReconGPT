import { useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Shield, Globe, Link as LinkIcon, Code, AlertTriangle } from 'lucide-react'

interface AttackSurfaceGraphProps {
  scanId: string
  data?: {
    domain: string
    subdomains: string[]
    liveHosts: string[]
    technologies: Record<string, string[]>
    jsFiles: string[]
    endpoints: string[]
    vulnerabilities: Array<{ endpoint: string; severity: string }>
  }
}

const nodeTypes = {
  domain: ({ data }: any) => (
    <div className="px-6 py-4 rounded-2xl bg-brand-yellow text-brand-dark shadow-lg border-2 border-brand-dark">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5" />
        <div>
          <div className="text-xs font-medium opacity-70">Target</div>
          <div className="font-bold">{data.label}</div>
        </div>
      </div>
    </div>
  ),
  subdomain: ({ data }: any) => (
    <div className="px-4 py-3 rounded-xl bg-white shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-2">
        <LinkIcon className="w-4 h-4 text-brand-muted" />
        <div className="text-sm font-medium">{data.label}</div>
      </div>
      {data.isLive && <div className="mt-1 inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded">Live</div>}
    </div>
  ),
  technology: ({ data }: any) => (
    <div className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 shadow-sm">
      <div className="text-xs font-medium text-blue-900">{data.label}</div>
    </div>
  ),
  jsfile: ({ data }: any) => (
    <div className="px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 shadow-sm">
      <Code className="w-3 h-3 text-purple-600 mb-1" />
      <div className="text-[10px] font-medium text-purple-900 truncate max-w-[120px]">{data.label}</div>
    </div>
  ),
  endpoint: ({ data }: any) => (
    <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 shadow-sm">
      <div className="text-[10px] font-medium text-gray-900 truncate max-w-[150px]">{data.label}</div>
    </div>
  ),
  vulnerability: ({ data }: any) => (
    <div className={`px-3 py-2 rounded-lg shadow-md border-2 ${
      data.severity === 'critical' ? 'bg-red-100 border-red-500' :
      data.severity === 'high' ? 'bg-orange-100 border-orange-500' :
      data.severity === 'medium' ? 'bg-yellow-100 border-yellow-500' :
      'bg-gray-100 border-gray-400'
    }`}>
      <AlertTriangle className={`w-3 h-3 mb-1 ${
        data.severity === 'critical' ? 'text-red-600' :
        data.severity === 'high' ? 'text-orange-600' :
        data.severity === 'medium' ? 'text-yellow-600' :
        'text-gray-600'
      }`} />
      <div className="text-[10px] font-bold uppercase">{data.severity}</div>
    </div>
  ),
}

export function AttackSurfaceGraph({ data }: AttackSurfaceGraphProps) {
  const initialNodes: Node[] = useMemo(() => {
    if (!data) return []

    const nodes: Node[] = []
    let yOffset = 0
    const xSpacing = 250
    const ySpacing = 100

    // Domain node (center top)
    nodes.push({
      id: 'domain',
      type: 'domain',
      position: { x: 500, y: yOffset },
      data: { label: data.domain },
    })

    yOffset += ySpacing

    // Subdomains (second layer)
    data.subdomains.slice(0, 10).forEach((subdomain, i) => {
      nodes.push({
        id: `subdomain-${i}`,
        type: 'subdomain',
        position: { x: 200 + (i % 5) * xSpacing, y: yOffset + Math.floor(i / 5) * ySpacing },
        data: { label: subdomain, isLive: data.liveHosts.includes(subdomain) },
      })
    })

    yOffset += ySpacing * 2

    // JS Files
    data.jsFiles.slice(0, 8).forEach((jsFile, i) => {
      nodes.push({
        id: `js-${i}`,
        type: 'jsfile',
        position: { x: 150 + (i % 4) * 200, y: yOffset + Math.floor(i / 4) * 80 },
        data: { label: jsFile.split('/').pop() },
      })
    })

    yOffset += ySpacing * 2

    // Endpoints
    data.endpoints.slice(0, 12).forEach((endpoint, i) => {
      nodes.push({
        id: `endpoint-${i}`,
        type: 'endpoint',
        position: { x: 100 + (i % 6) * 180, y: yOffset + Math.floor(i / 6) * 70 },
        data: { label: endpoint },
      })
    })

    yOffset += ySpacing * 2

    // Vulnerabilities
    data.vulnerabilities.slice(0, 10).forEach((vuln, i) => {
      nodes.push({
        id: `vuln-${i}`,
        type: 'vulnerability',
        position: { x: 200 + (i % 5) * 200, y: yOffset + Math.floor(i / 5) * 80 },
        data: { severity: vuln.severity, label: vuln.endpoint },
      })
    })

    return nodes
  }, [data])

  const initialEdges: Edge[] = useMemo(() => {
    if (!data) return []

    const edges: Edge[] = []

    // Connect domain to subdomains
    data.subdomains.slice(0, 10).forEach((_, i) => {
      edges.push({
        id: `e-domain-sub-${i}`,
        source: 'domain',
        target: `subdomain-${i}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#2B2B2B', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#2B2B2B' },
      })
    })

    // Connect subdomains to JS files
    data.jsFiles.slice(0, 8).forEach((_, i) => {
      const subdomainIndex = i % Math.min(10, data.subdomains.length)
      edges.push({
        id: `e-sub-js-${i}`,
        source: `subdomain-${subdomainIndex}`,
        target: `js-${i}`,
        type: 'smoothstep',
        style: { stroke: '#9333ea', strokeWidth: 1.5 },
      })
    })

    // Connect JS files to endpoints
    data.endpoints.slice(0, 12).forEach((_, i) => {
      const jsIndex = i % Math.min(8, data.jsFiles.length)
      edges.push({
        id: `e-js-endpoint-${i}`,
        source: `js-${jsIndex}`,
        target: `endpoint-${i}`,
        type: 'smoothstep',
        style: { stroke: '#6b7280', strokeWidth: 1 },
      })
    })

    // Connect endpoints to vulnerabilities
    data.vulnerabilities.slice(0, 10).forEach((_, i) => {
      const endpointIndex = i % Math.min(12, data.endpoints.length)
      edges.push({
        id: `e-endpoint-vuln-${i}`,
        source: `endpoint-${endpointIndex}`,
        target: `vuln-${i}`,
        type: 'smoothstep',
        style: { stroke: '#ef4444', strokeWidth: 2 },
        animated: true,
      })
    })

    return edges
  }, [data])

  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, _setEdges, onEdgesChange] = useEdgesState(initialEdges)

  if (!data) {
    return (
      <div className="card h-[600px] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-brand-muted mx-auto mb-4" />
          <p className="text-brand-muted">No scan data available. Start a scan to visualize attack surface.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card h-[600px] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#e5e5e5" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'domain') return '#FFD966'
            if (node.type === 'vulnerability') return '#ef4444'
            return '#e5e5e5'
          }}
          maskColor="rgba(255, 255, 255, 0.8)"
        />
      </ReactFlow>
    </div>
  )
}
