import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Suspense, useState } from 'react'
import {
  Layout,
  Briefcase,
  Scan,
  Globe,
  Network,
  WarningCircle,
  Robot,
  FileText,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react'
import { SidebarSection } from './SidebarSection'
import { DropdownMenuAvatar } from '@/components/common/DropdownMenuAvatar'

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
      icon: Layout,
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
      icon: Scan,
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
      icon: WarningCircle,
    },
    {
      href: '/ai-analysis',
      label: 'AI Analysis',
      icon: Robot,
    },
    {
      href: '/reports',
      label: 'Reports',
      icon: FileText,
    },
  ]

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
    <div className="flex flex-1 flex-col overflow-hidden font-sans">
      <nav className="flex-1 overflow-y-auto">
        <SidebarSection title="" isCollapsed={isCollapsed}>
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
                      title={isCollapsed ? item.label : undefined}
                      className={`mx-2 my-0.5 flex flex-1 items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] transition-colors duration-200 ${
                        active && !isCollapsed
                          ? 'text-neutral-100 font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] flex-shrink-0 ${
                          active ? 'text-neutral-100' : 'text-neutral-500'
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
                        className="mr-3 p-1 text-neutral-500 hover:text-neutral-300 transition-colors rounded-md"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <CaretDown className="h-3.5 w-3.5" />
                        ) : (
                          <CaretRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {hasSubItems && isExpanded && !isCollapsed && (
                    <div className="flex flex-col gap-[2px] mt-0.5 ml-[26px] pl-4 border-l border-neutral-800">
                      {item.subItems!.map((subItem) => (
                        <Link
                          key={subItem.href}
                          to={subItem.href}
                          className={`flex items-center pr-4 py-2.5 mx-3 text-[13px] rounded-lg transition-colors duration-200 ${
                            isSubItemActive(item.href, subItem.href)
                              ? 'text-neutral-100 font-medium'
                              : 'text-neutral-400 hover:text-neutral-200'
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

      <div className="px-2 py-3 mt-auto shrink-0 border-t border-neutral-800">
        <DropdownMenuAvatar isCollapsed={isCollapsed} />
      </div>
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
