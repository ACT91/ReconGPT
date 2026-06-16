import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Suspense, useState } from 'react'
import {
  LayoutDashboard,
  Briefcase,
  ScanLine,
  Globe,
  Network,
  AlertTriangle,
  Bot,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  LogOut,
} from 'lucide-react'
import { SidebarSection } from './SidebarSection'
import { useLogout } from '@/hooks/useAuth'

type SidebarNavProps = {
  isCollapsed: boolean
}

type NavItem = {
  href: string
  label: string
  icon: any
  subItems?: { href: string; label: string }[]
}

function SidebarNavContent({ isCollapsed }: SidebarNavProps) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const pathname = location.pathname
  const activeTab = searchParams.get('tab')

  const navItems: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/projects',
      label: 'Projects',
      icon: Briefcase,
      subItems: [
        { href: '/projects?tab=active', label: 'Active' },
        { href: '/projects?tab=archived', label: 'Archived' },
      ],
    },
    {
      href: '/scans',
      label: 'Scans',
      icon: ScanLine,
      subItems: [
        { href: '/scans', label: 'All Scans' },
        { href: '/scans?tab=history', label: 'History' },
      ],
    },
    {
      href: '/assets',
      label: 'Assets',
      icon: Globe,
    },
    {
      href: '/endpoints',
      label: 'Endpoints',
      icon: Network,
    },
    {
      href: '/findings',
      label: 'Findings',
      icon: AlertTriangle,
    },
    {
      href: '/ai-analysis',
      label: 'AI Analysis',
      icon: Bot,
    },
    {
      href: '/reports',
      label: 'Reports',
      icon: FileText,
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ]

  const logout = useLogout()

  const toggleExpand = (href: string) => {
    setExpandedItem(expandedItem === href ? null : href)
  }

  const isSubItemActive = (parentHref: string, subHref: string) => {
    if (pathname !== parentHref && !pathname.startsWith(parentHref + '/')) return false
    const subTab = subHref.includes('tab=')
      ? new URLSearchParams(subHref.split('?')[1]).get('tab')
      : null
    if (!subTab) return pathname === subHref
    return activeTab === subTab && pathname === parentHref
  }

  const isParentActive = (item: NavItem) => {
    if (pathname === item.href) return true
    if (item.subItems) {
      return item.subItems.some(
        (sub) =>
          pathname === sub.href ||
          new URLSearchParams(sub.href.split('?')[1] || '').get('tab') === activeTab,
      )
    }
    return false
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden font-['Hanken_Grotesk']">
      <nav className="flex-1 overflow-y-auto">
        <SidebarSection title="Navigation" isCollapsed={isCollapsed}>
          <ul className="flex list-none flex-col gap-0 pl-0">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isParentActive(item)
              const isExpanded = expandedItem === item.href
              const hasSubItems = item.subItems && item.subItems.length > 0

              return (
                <li key={item.href} className="flex flex-col">
                  <div className="flex items-center">
                    <Link
                      to={item.href}
                      className={`mx-2 my-0.5 flex flex-1 items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] transition-colors duration-200 ${
                        active && !isCollapsed
                          ? 'bg-sidebar-active/10 text-sidebar-active font-medium'
                          : 'text-zinc-400 hover:bg-sidebar-hover hover:text-zinc-200'
                      } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] flex-shrink-0 ${
                          active ? 'text-sidebar-active' : 'text-zinc-500'
                        }`}
                      />
                      <span
                        className={`transition-all duration-300 ${
                          isCollapsed
                            ? 'w-0 overflow-hidden opacity-0'
                            : 'w-auto opacity-100'
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                    {hasSubItems && !isCollapsed && (
                      <button
                        onClick={() => toggleExpand(item.href)}
                        className="mr-3 p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded-md hover:bg-sidebar-hover"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {hasSubItems && isExpanded && !isCollapsed && (
                    <div className="flex flex-col gap-[2px] mt-0.5 ml-[26px] pl-4 border-l border-zinc-800">
                      {item.subItems!.map((subItem) => (
                        <Link
                          key={subItem.href}
                          to={subItem.href}
                          className={`flex items-center pr-4 py-2.5 mx-3 text-[13px] rounded-lg transition-colors duration-200 ${
                            isSubItemActive(item.href, subItem.href)
                              ? 'text-sidebar-active font-medium'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </SidebarSection>
      </nav>

      {!isCollapsed && (
        <div className="px-4 py-4 space-y-0.5 shrink-0 border-t border-zinc-800 mt-2">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-sidebar-hover rounded-xl transition-colors text-[13px]"
          >
            <HelpCircle className="h-[18px] w-[18px] text-zinc-500" />
            <span className="font-medium">Help & Information</span>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-sidebar-hover rounded-xl transition-colors text-[13px]"
          >
            <LogOut className="h-[18px] w-[18px] text-zinc-500" />
            <span className="font-medium">Log out</span>
          </button>
        </div>
      )}
      {isCollapsed && (
        <div className="px-2 py-4 space-y-0.5 shrink-0 border-t border-zinc-800 mt-2 flex flex-col items-center">
          <Link
            to="/settings"
            className="p-2.5 text-zinc-500 hover:text-zinc-200 hover:bg-sidebar-hover rounded-xl transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-[18px] w-[18px]" />
          </Link>
          <button
            onClick={logout}
            className="p-2.5 text-zinc-500 hover:text-zinc-200 hover:bg-sidebar-hover rounded-xl transition-colors"
            aria-label="Log out"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}
    </div>
  )
}

export function SidebarNav(props: SidebarNavProps) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <SidebarNavContent {...props} />
    </Suspense>
  )
}
