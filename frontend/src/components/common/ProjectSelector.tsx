import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/services/api'
import { useProjectStore } from '@/store/project'
import type { Project } from '@/types'
import { Briefcase } from '@phosphor-icons/react'

export function ProjectSelector() {
  const { selectedProject, setSelectedProject, clearProject } = useProjectStore()

  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list({ page_size: 100 }),
  })

  const projects = data?.items || []

  return (
    <div className="flex items-center gap-2">
      <Briefcase className="h-4 w-4 text-neutral-500 shrink-0" />
      <select
        value={selectedProject?.id || ''}
        onChange={(e) => {
          const id = e.target.value
          if (!id) {
            clearProject()
          } else {
            const project = projects.find((p: Project) => p.id === id)
            if (project) setSelectedProject(project)
          }
        }}
        className="bg-transparent border-none text-sm text-neutral-300 focus:outline-none cursor-pointer max-w-[180px] truncate"
      >
        <option value="">All Projects</option>
        {projects.map((p: Project) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  )
}
