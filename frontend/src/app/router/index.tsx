import { Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { useCurrentUser } from '@/hooks/useAuth'
import { Dashboard } from '@/pages/dashboard'
import {
  ProjectsPage,
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

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
        <Route path="/scans" element={<ScansPage />} />
        <Route path="/scans/:scanId" element={<ScansPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assets/:scanId" element={<AssetsPage />} />
        <Route path="/endpoints" element={<EndpointsPage />} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/ai-analysis" element={<AIAnalysisPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}