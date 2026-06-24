import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/services/api'
import { useProjectStore } from '@/store/project'
import type { Project } from '@/types'
import { CaretUpDown, Check } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

export function ProjectSelector({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { selectedProject, setSelectedProject, clearProject } = useProjectStore()

  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list({ page_size: 100 }),
  })

  const projects = data?.items || []

  useEffect(() => {
    if (selectedProject && projects.length > 0) {
      const exists = projects.some((p: Project) => p.id === selectedProject.id)
      if (!exists) {
        clearProject()
      }
    }
  }, [projects, selectedProject, clearProject])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`flex items-center gap-2 hover:bg-neutral-800/50 p-1.5 rounded-lg transition-colors text-left outline-none ${isCollapsed ? 'justify-center w-full' : 'flex-1 min-w-0'}`}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-sidebar-bg font-bold text-sm">R</span>
        </div>
        {!isCollapsed && (
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <span className="font-semibold text-[15px] text-neutral-100 tracking-tight truncate">
              Reconny
            </span>
            <span className="text-[11px] text-neutral-500 truncate leading-none mt-0.5">
              {selectedProject ? selectedProject.name : 'All Projects'}
            </span>
          </div>
        )}
        {!isCollapsed && (
          <CaretUpDown className="h-4 w-4 text-neutral-500 shrink-0 ml-auto" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isCollapsed ? "center" : "start"}
        side={isCollapsed ? "right" : "bottom"}
        sideOffset={isCollapsed ? 16 : 8}
        className="w-56"
      >
        <DropdownMenuLabel className="text-xs text-neutral-500">Projects</DropdownMenuLabel>
        <DropdownMenuItem
          className="gap-2 cursor-pointer"
          onClick={() => clearProject()}
        >
          <div className="w-4 h-4 flex items-center justify-center">
            {!selectedProject && <Check className="h-3 w-3" />}
          </div>
          All Projects
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {projects.map((p: Project) => (
          <DropdownMenuItem
            key={p.id}
            className="gap-2 cursor-pointer"
            onClick={() => setSelectedProject(p)}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {selectedProject?.id === p.id && <Check className="h-3 w-3" />}
            </div>
            {p.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
