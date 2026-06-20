import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { ErrorBoundary, ProjectSelector } from '@/components/common'
import { SidebarNav } from '@/components/layouts/SidebarNav'
import { List } from '@phosphor-icons/react'

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-sidebar-bg">
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile toggle button */}
      {!mobileSidebarOpen && (
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-sidebar-bg border border-neutral-800 text-neutral-400 hover:text-neutral-200"
          aria-label="Toggle sidebar"
        >
          <List className="h-5 w-5" />
        </button>
      )}

      {/* Sidebar — always fixed so content can slide smoothly alongside */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar-bg border-r border-neutral-800 transition-all duration-300 ease-in-out ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-800 shrink-0 relative">
          <div className={`flex items-center flex-1 min-w-0 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
            <ProjectSelector isCollapsed={sidebarCollapsed} />
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 transition-colors shrink-0 ml-2"
              aria-label="Collapse sidebar"
            >
              <List className="h-4 w-4" />
            </button>
          )}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors z-50"
              aria-label="Expand sidebar"
            >
              <List className="h-3 w-3" />
            </button>
          )}
        </div>

        <SidebarNav isCollapsed={sidebarCollapsed} />
      </aside>

      {/* Main content — margin-left transitions with the sidebar width */}
      <main
        className={`min-h-screen overflow-y-auto p-4 md:p-6 bg-background transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'
        }`}
      >
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
