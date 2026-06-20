import { Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { useCurrentUser } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/common'
import { Dashboard } from '@/pages/dashboard'
import {
  ProjectsPage,
  ProjectDetailPage,
  ScansPage,
  AssetsPage,
  EndpointsPage,
  FindingsPage,
  AIAnalysisPage,
  ReportsPage,
  SettingsPage,
} from '@/pages'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { PrivacyPage } from '@/pages/auth/PrivacyPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/scans" element={<ScansPage />} />
        <Route path="/scans/:scanId" element={<ScansPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assets/:scanId" element={<AssetsPage />} />
        <Route path="/endpoints" element={<EndpointsPage />} />
        <Route path="/endpoints/:scanId" element={<EndpointsPage />} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/findings/:scanId" element={<FindingsPage />} />
        <Route path="/ai-analysis" element={<AIAnalysisPage />} />
        <Route path="/ai-analysis/:scanId" element={<AIAnalysisPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:scanId" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}