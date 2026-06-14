import { Outlet } from 'react-router-dom'
import { Navigation } from '@/components/layouts/Navigation'
import { ErrorBoundary } from '@/components/common'

export function MainLayout() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="p-4 md:p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
