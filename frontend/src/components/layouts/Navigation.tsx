import { Link, useLocation } from 'react-router-dom'
import { Gear, Bell } from '@phosphor-icons/react'

const navLinks = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/scans', label: 'Scans' },
  { path: '/assets', label: 'Assets' },
  { path: '/findings', label: 'Findings' },
]

export function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <nav className="flex flex-wrap items-center justify-between mb-8 gap-4 px-4 md:px-6 py-3 border-b border-neutral-800">
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-2 px-3 py-1.5">
        <div className="w-6 h-6 rounded-lg bg-primary"></div>
        <span className="font-semibold text-lg tracking-tight">Reconny</span>
      </Link>

      {/* Navigation Links */}
      <ul className="hidden md:flex items-center gap-1">
        {navLinks.map((link) => (
          <li key={link.path}>
            <Link
              to={link.path}
              className={isActive(link.path) ? 'nav-link-active' : 'nav-link-inactive'}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-neutral-900 transition-colors">
          <Gear className="w-5 h-5 text-neutral-400" />
        </button>
        <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-neutral-900 transition-colors">
          <Bell className="w-5 h-5 text-neutral-400" />
        </button>
        <div className="w-9 h-9 rounded-lg bg-neutral-800 overflow-hidden ml-1">
          <img
            alt="Avatar"
            className="w-full h-full object-cover"
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=reconny"
          />
        </div>
      </div>
    </nav>
  )
}
