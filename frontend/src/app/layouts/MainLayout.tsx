import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { ErrorBoundary } from '@/components/common'
import { SidebarNav } from '@/components/layouts/SidebarNav'
import { Menu, X } from 'lucide-react'

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-sidebar-bg">
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-sidebar-bg border border-zinc-800 text-zinc-400 hover:text-zinc-200"
        aria-label="Toggle sidebar"
      >
        {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col bg-sidebar-bg border-r border-zinc-800 transition-all duration-300 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800 shrink-0">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="w-8 h-8 rounded-lg bg-sidebar-active flex items-center justify-center">
              <span className="text-sidebar-bg font-bold text-sm">R</span>
            </div>
            {!sidebarCollapsed && (
              <span className="font-semibold text-[15px] text-zinc-100 tracking-tight">
                ReconGPT
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-sidebar-hover transition-colors"
              aria-label="Collapse sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-sidebar-bg border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Expand sidebar"
            >
              <Menu className="h-3 w-3" />
            </button>
          )}
        </div>

        <SidebarNav isCollapsed={sidebarCollapsed} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        <main className="flex-1 p-4 md:p-8 bg-background">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
