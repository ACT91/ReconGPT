import { useNavigate } from 'react-router-dom'
import { User, Gear, SignOut, CaretUpDown, Moon, Sun } from '@phosphor-icons/react'
import { useAuthStore } from '@/store/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useState } from 'react'

export function DropdownMenuAvatar({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'RN'

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  const toggleTheme = () => {
    const newDark = !isDark
    setIsDark(newDark)
    document.documentElement.classList.toggle('dark', newDark)
    localStorage.setItem('theme', newDark ? 'dark' : 'light')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`flex items-center gap-2 hover:bg-neutral-800/50 p-1.5 rounded-lg transition-colors text-left outline-none w-full ${isCollapsed ? 'justify-center' : ''}`}>
        <Avatar className="h-8 w-8 rounded-lg shrink-0">
          <AvatarImage
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || 'default')}`}
            alt={user?.full_name || 'avatar'}
          />
          <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
        </Avatar>
        {!isCollapsed && (
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <span className="font-semibold text-[14px] text-neutral-100 tracking-tight truncate">
              {user?.full_name || 'User'}
            </span>
            <span className="text-[11px] text-neutral-500 truncate leading-none mt-0.5">
              {user?.email || 'user@example.com'}
            </span>
          </div>
        )}
        {!isCollapsed && (
          <CaretUpDown className="h-4 w-4 text-neutral-500 shrink-0 ml-auto" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isCollapsed ? "center" : "end"}
        side={isCollapsed ? "right" : "bottom"}
        sideOffset={isCollapsed ? 16 : 8}
        className="w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-neutral-100">{user?.full_name || 'User'}</p>
            <p className="text-xs text-neutral-500">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2">
            <User className="h-4 w-4 text-neutral-500" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2">
            <Gear className="h-4 w-4 text-neutral-500" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme} className="gap-2">
            {isDark ? <Sun className="h-4 w-4 text-neutral-500" /> : <Moon className="h-4 w-4 text-neutral-500" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-neutral-400 gap-2 cursor-pointer">
          <SignOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
