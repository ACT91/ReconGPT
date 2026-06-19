import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { ErrorBoundary, ProjectSelector, DropdownMenuAvatar } from '@/components/common'
import { SidebarNav } from '@/components/layouts/SidebarNav'
import { List, X } from '@phosphor-icons/react'

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="h-screen overflow-hidden flex bg-sidebar-bg">
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
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-sidebar-bg border border-neutral-800 text-neutral-400 hover:text-neutral-200"
        aria-label="Toggle sidebar"
      >
        {mobileSidebarOpen ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col bg-sidebar-bg border-r border-neutral-800 transition-all duration-300 overflow-y-auto ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-800 shrink-0">
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sidebar-bg font-bold text-sm">R</span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-semibold text-[15px] text-neutral-100 tracking-tight">
                  Reconny
                </span>
                <ProjectSelector />
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 transition-colors"
              aria-label="Collapse sidebar"
            >
              <List className="h-4 w-4" />
            </button>
          )}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-sidebar-bg border border-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
              aria-label="Expand sidebar"
            >
              <List className="h-3 w-3" />
            </button>
          )}
        </div>

        <SidebarNav isCollapsed={sidebarCollapsed} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-end h-14 px-4 md:px-6 border-b border-neutral-800 bg-sidebar-bg shrink-0">
          <DropdownMenuAvatar />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
