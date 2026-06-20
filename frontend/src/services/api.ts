import axios, { AxiosError, type AxiosRequestConfig } from 'axios'

interface RetryConfig extends AxiosRequestConfig {
  _isRetry?: boolean
}
import type {
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  User,
  Project,
  ProjectCreate,
  ScanJob,
  ScanRequest,
  ScanResponse,
  PaginatedResponse,
  PaginationParams,
  Subdomain,
  Endpoint,
  Vulnerability,
  APIKey,
  APIKeyCreate,
  APIKeyFull,
  AggregatedStats,
  ProjectStats,
  ScanProgress,
  ScanLogsResponse,
  AiInsight,
  ApiError,
  DashboardData,
} from '@/types'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const apiKey = localStorage.getItem('api_key')
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const config = error.config as RetryConfig | undefined
    if (config?._isRetry) return Promise.reject(error)
    if (error.response?.status === 401 && !config?.url?.includes('/auth/')) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        const { data } = await axios.post<AuthTokens>('/api/v1/auth/refresh', {
          refresh_token: refreshToken,
        })
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        if (!config) return Promise.reject(error)
        config._isRetry = true
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${data.access_token}`
        return api.request(config)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export function getApiError(error: unknown): string {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as ApiError
    return data.detail || data.error || error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<AuthTokens>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    api.post<User>('/auth/register', data).then((r) => r.data),

  refresh: (refresh_token: string) =>
    api.post<AuthTokens>('/auth/refresh', { refresh_token }).then((r) => r.data),

  me: () => api.get<User>('/auth/me').then((r) => r.data),

  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }).then((r) => r.data),

  deleteAccount: () =>
    api.delete('/auth/me').then((r) => r.data),

  exportData: () =>
    api.get<Record<string, unknown>>('/auth/me/export').then((r) => r.data),

  listApiKeys: () =>
    api.get<APIKey[]>('/auth/api-keys').then((r) => r.data),

  createApiKey: (data: APIKeyCreate) =>
    api.post<APIKeyFull>('/auth/api-keys', data).then((r) => r.data),

  revokeApiKey: (keyId: string) =>
    api.delete(`/auth/api-keys/${keyId}`).then((r) => r.data),
}


export const projectApi = {
  create: (data: ProjectCreate) =>
    api.post<Project>('/projects', data).then((r) => r.data),

  list: (params?: PaginationParams) =>
    api.get<PaginatedResponse<Project>>('/projects', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Project>(`/projects/${id}`).then((r) => r.data),

  getStats: (id: string) =>
    api.get<ProjectStats>(`/projects/${id}/stats`).then((r) => r.data),

  update: (id: string, data: Partial<ProjectCreate>) =>
    api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/projects/${id}`).then((r) => r.data),
}

export const scanApi = {
  start: (data: ScanRequest) =>
    api.post<ScanResponse>('/scans/start', data).then((r) => r.data),

  list: (params?: PaginationParams & { project_id?: string; status?: string }) =>
    api.get<PaginatedResponse<ScanJob>>('/scans', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<ScanJob>(`/scans/${id}`).then((r) => r.data),

  getProgress: (id: string) =>
    api.get<ScanProgress>(`/scans/${id}/progress`).then((r) => r.data),

  getLogs: (id: string, params?: { stage?: string; level?: string; page?: number; page_size?: number }) =>
    api.get<ScanLogsResponse>(`/scans/${id}/logs`, { params }).then((r) => r.data),

  getSubdomains: (id: string, params?: PaginationParams) =>
    api.get<PaginatedResponse<Subdomain>>(`/scans/${id}/subdomains`, { params }).then((r) => r.data),

  getVulnerabilities: (id: string, params?: PaginationParams & { severity?: string }) =>
    api.get<PaginatedResponse<Vulnerability>>(`/scans/${id}/vulnerabilities`, { params }).then((r) => r.data),

  cancel: (id: string, force?: boolean) =>
    api.post(`/scans/${id}/cancel`, { force }).then((r) => r.data),

  retry: (id: string) =>
    api.post<ScanResponse>(`/scans/${id}/retry`).then((r) => r.data),

  markFalsePositive: (jobId: string, vulnId: string, is_false_positive: boolean) =>
    api.patch(`/scans/${jobId}/vulnerabilities/${vulnId}`, {
      is_false_positive,
    }).then((r) => r.data),

  runVulnScan: (jobId: string) =>
    api.post<ScanResponse>(`/scans/${jobId}/vuln-scan`).then((r) => r.data),
}

export const resultApi = {
  getOverview: (id: string) =>
    api.get(`/results/${id}/overview`).then((r) => r.data),

  getFull: (id: string) =>
    api.get<{
      scan_job: ScanJob
      subdomains: Subdomain[]
      endpoints: Endpoint[]
      vulnerabilities: Vulnerability[]
      ai_insights: AiInsight[]
      aggregated_stats: AggregatedStats
      total_subdomains: number
      total_endpoints: number
      total_vulnerabilities: number
    }>(`/results/${id}`).then((r) => r.data),

  getStats: (id: string) =>
    api.get<AggregatedStats>(`/results/${id}/stats`).then((r) => r.data),

  getGraph: (id: string) =>
    api.get(`/results/${id}/graph`).then((r) => r.data),

  getEndpoints: (id: string) =>
    api.get<PaginatedResponse<Endpoint>>(`/results/${id}/endpoints`).then((r) => r.data),
}

export const dashboardApi = {
  get: () =>
    api.get<DashboardData>('/dashboard/').then((r) => r.data),
}

export const insightApi = {
  list: (id: string, params?: { type?: string; priority?: string; actionable_only?: boolean; page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<AiInsight>>(`/insights/${id}`, { params }).then((r) => r.data),

  executiveSummary: (id: string) =>
    api.get<AiInsight>(`/insights/${id}/executive-summary`).then((r) => r.data),

  riskScore: (id: string) =>
    api.get(`/insights/${id}/risk-score`).then((r) => r.data),

  attackVectors: (id: string) =>
    api.get(`/insights/${id}/attack-vectors`).then((r) => r.data),

  update: (jobId: string, insightId: string, data: Record<string, unknown>) =>
    api.patch<AiInsight>(`/insights/${jobId}/${insightId}`, data).then((r) => r.data),
}

export const dataApi = {
  listSubdomains: (params?: {
    project_id?: string
    scan_id?: string
    search?: string
    status?: string
    page?: number
    page_size?: number
  }) =>
    api.get('/data/subdomains', { params }).then((r) => r.data),

  listEndpoints: (params?: {
    project_id?: string
    scan_id?: string
    search?: string
    source?: string
    method?: string
    page?: number
    page_size?: number
  }) =>
    api.get('/data/endpoints', { params }).then((r) => r.data),

  listVulnerabilities: (params?: {
    project_id?: string
    scan_id?: string
    severity?: string
    search?: string
    is_false_positive?: boolean
    page?: number
    page_size?: number
  }) =>
    api.get('/data/vulnerabilities', { params }).then((r) => r.data),

  listInsights: (params?: {
    project_id?: string
    scan_id?: string
    insight_type?: string
    priority?: string
    search?: string
    actionable_only?: boolean
    page?: number
    page_size?: number
  }) =>
    api.get('/data/insights', { params }).then((r) => r.data),

  getStats: (params?: { project_id?: string }) =>
    api.get('/data/stats', { params }).then((r) => r.data),
}

export default api