export interface User {
  id: string
  email: string
  full_name?: string
  role: string
  is_active: boolean
  is_verified: boolean
  created_at: string
  updated_at: string
  last_login?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  target_domains: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  name: string
  description?: string
  target_domains: string[]
}

export enum JobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIAL = 'partial',
}

export enum PipelineStage {
  SUBDOMAIN_ENUM = '01_subdomain_enum',
  LIVE_PROBE = '02_live_probe',
  TECH_DETECT = '03_tech_detect',
  WEB_CRAWL = '04_web_crawl',
  JS_EXTRACT = '05_js_extract',
  ENDPOINT_EXTRACT = '06_endpoint_extract',
  JS_DOWNLOAD = '07_js_download',
  JS_ANALYSIS = '08_js_analysis',
  ENDPOINT_MERGE = '09_endpoint_merge',
  URL_RECONSTRUCT = '10_url_reconstruct',
  ENDPOINT_PROBE = '11_endpoint_probe',
  VULN_SCAN = '12_vuln_scan',
  AI_ANALYSIS = '13_ai_analysis',
}

export interface ScanJob {
  id: string
  project_id?: string
  target_domain: string
  status: JobStatus
  current_stage: PipelineStage | null
  progress_percent: number
  error_message?: string
  celery_task_id?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface ScanRequest {
  target_domain: string
  project_id?: string
  scan_config?: Record<string, unknown>
}

export interface ScanResponse {
  job_id: string
  status: string
  message: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PaginationParams {
  page?: number
  page_size?: number
  sort?: string
  search?: string
}

export interface Subdomain {
  id: string
  name: string
  is_alive: boolean
  status_code?: number
  technologies?: string[]
  title?: string
  web_server?: string
  ips?: string[]
  cname?: string
  content_length?: number
  discovered_at?: string
}

export interface Endpoint {
  id: string
  subdomain_id?: string
  url: string
  normalized_url: string
  path?: string
  method: string
  source: string
  status: string
  status_code?: number
  content_type?: string
  content_length?: number
  title?: string
  technologies: string[]
  response_time_ms?: number
  parameters: Record<string, unknown>
  discovered_at: string
  probed_at?: string
}

export interface Vulnerability {
  id: string
  name: string
  template_id: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  url: string
  description?: string
  remediation?: string
  cve_ids?: string[]
  cwe_ids?: string[]
  cvss_score?: number
  matched_at?: string
  discovered_at?: string
  is_false_positive?: boolean
}

export interface JsFile {
  id: string
  url: string
  downloaded: boolean
  analyzed: boolean
  size_bytes?: number
  endpoints_found: number
  secrets_found: number
}

export interface AiInsight {
  id: string
  type: string
  priority: string
  title: string
  summary: string
  content?: string
  priority_score: number
  is_actionable: boolean
  is_dismissed: boolean
  affected_assets?: string[]
  related_vulnerabilities?: string[]
  related_subdomains?: string[]
  related_endpoints?: string[]
  created_at: string
}

export interface ScanProgress {
  job_id: string
  overall_status: JobStatus
  overall_progress: number
  current_stage: PipelineStage | null
  stages: StageProgress[]
}

export interface StageProgress {
  stage: PipelineStage
  status: JobStatus
  progress_percent: number
  started_at?: string
  completed_at?: string
  error_message?: string
}

export interface ScanLogEntry {
  id?: string
  stage?: string
  level: string
  message: string
  timestamp?: string
  details?: Record<string, unknown>
}

export interface ScanLogsResponse {
  items: ScanLogEntry[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface APIKey {
  id: string
  name: string
  key_prefix: string
  is_active: boolean
  expires_at?: string
  last_used_at?: string
  created_at: string
}

export interface APIKeyCreate {
  name: string
  expires_in_days?: number
}

export interface APIKeyFull extends APIKey {
  key: string
}

export interface AggregatedStats {
  total_subdomains: number
  live_subdomains: number
  total_endpoints: number
  live_endpoints: number
  total_vulnerabilities: number
  vulnerabilities_by_severity: Record<string, number>
  technologies: Record<string, number>
  web_servers: Record<string, number>
  status_codes: Record<string, number>
  top_subdomains_by_vulns: { name: string; vulnerabilities: number }[]
  top_endpoints_by_vulns: { name: string; url: string; vulnerabilities: number }[]
}

export interface ProjectStats {
  total_scans: number
  completed_scans: number
  failed_scans: number
  running_scans: number
  total_subdomains: number
  total_endpoints: number
  total_vulnerabilities: number
  critical_vulns: number
  high_vulns: number
  medium_vulns: number
  low_vulns: number
}

export interface ApiError {
  error: string
  detail?: string
  code?: string
  errors?: { field?: string; msg?: string }[]
  request_id?: string
}

export type WSMessage = {
  job_id: string
  type: 'progress' | 'log' | 'status'
  stage?: string
  progress?: number
  level?: string
  message?: string
  status?: string
  error?: string | null
  details?: Record<string, unknown>
  timestamp: number
}