import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi, scanApi, getApiError } from '@/services/api'
import { ErrorBoundary, SkeletonCardGrid } from '@/components/common'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { Plus, Trash, Pencil, Folder, Crosshair, Warning } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import type { Project, ProjectCreate, ScanJob } from '@/types'
import { useNavigate } from 'react-router-dom'

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project
  onEdit: (p: Project) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['project-stats', project.id],
    queryFn: () => projectApi.getStats(project.id),
    enabled: !!project.id,
  })

  const { data: scans } = useQuery({
    queryKey: ['project-scans', project.id],
    queryFn: () => scanApi.list({ project_id: project.id, page_size: 5 }),
    enabled: !!project.id,
  })

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 hover:border-neutral-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Folder className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h3
              className="font-medium text-neutral-100 cursor-pointer hover:text-primary transition-colors"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(project)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(project.id)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 transition-colors"
            title="Delete"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {project.target_domains && project.target_domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.target_domains.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-neutral-800 text-neutral-400"
            >
              <Crosshair className="h-3 w-3" />
              {domain}
            </span>
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-2 py-3 border-t border-neutral-800/50">
          <div className="text-center">
            <p className="text-lg font-semibold text-neutral-100">{stats.total_scans}</p>
            <p className="text-[11px] text-neutral-500">Scans</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-neutral-100">{stats.total_vulnerabilities}</p>
            <p className="text-[11px] text-neutral-500">Findings</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-neutral-100">{stats.total_subdomains}</p>
            <p className="text-[11px] text-neutral-500">Assets</p>
          </div>
        </div>
      )}

      {scans?.items && scans.items.length > 0 && (
        <div className="pt-2 border-t border-neutral-800/50">
          <p className="text-[11px] text-neutral-500 mb-1.5 uppercase tracking-wider">Recent Scans</p>
          <div className="space-y-1">
            {scans.items.slice(0, 3).map((scan: ScanJob) => (
              <div key={scan.id} className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 truncate">{scan.target_domain}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    scan.status === 'completed'
                      ? 'bg-neutral-600/10 text-neutral-300'
                      : scan.status === 'running'
                      ? 'bg-primary/10 text-primary'
                      : scan.status === 'failed'
                      ? 'bg-neutral-800/50 text-neutral-300'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {scan.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectForm({
  project,
  onSave,
  onCancel,
  isPending,
}: {
  project?: Project | null
  onSave: (data: ProjectCreate) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [domains, setDomains] = useState(project?.target_domains?.join('\n') || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      target_domains: domains
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm text-neutral-400">Project Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="My Project"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm text-neutral-400">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px] resize-none"
          placeholder="Optional description..."
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm text-neutral-400">Target Domains (one per line)</label>
        <textarea
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm min-h-[100px]"
          placeholder="example.com&#10;sub.example.com"
          rows={4}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} className="text-neutral-400 hover:text-neutral-200">
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending || !name.trim()}
          className="bg-primary text-sidebar-bg hover:bg-primary/90/90"
        >
          {isPending ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function ProjectsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list({ page_size: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowCreate(false)
      toast.success('Project created')
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProjectCreate> }) =>
      projectApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditingProject(null)
      toast.success('Project updated')
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: (err) => toast.error(getApiError(err)),
  })

  const handleDelete = (id: string) => {
    const project = projects.find((p) => p.id === id) || null
    setDeletingProject(project)
  }

  const confirmDelete = () => {
    if (!deletingProject) return
    deleteMutation.mutate(deletingProject.id)
    setDeletingProject(null)
  }

  const projects = data?.items || []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Projects</h1>
          <p className="text-sm text-neutral-400 mt-1">Organize your targets and scans</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-sidebar-bg hover:bg-primary/90/90 gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-neutral-800">
            <DialogHeader>
              <DialogTitle className="text-neutral-100">Create Project</DialogTitle>
              <DialogDescription className="text-neutral-400">
                Create a project to group related targets and scans
              </DialogDescription>
            </DialogHeader>
            <ProjectForm
              onSave={(data) => createMutation.mutate(data)}
              onCancel={() => setShowCreate(false)}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ErrorBoundary>
        {isLoading ? (
          <SkeletonCardGrid count={6} />
        ) : projects.length === 0 ? (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Folder className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>Create your first project to start organizing scans.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setShowCreate(true)} className="bg-primary text-sidebar-bg hover:bg-primary/90 gap-2">
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={setEditingProject}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </ErrorBoundary>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <Warning className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center text-neutral-100">Delete Project</DialogTitle>
            <DialogDescription className="text-center text-neutral-400">
              Are you sure you want to delete <strong className="text-neutral-200">{deletingProject?.name}</strong>? This will permanently delete the project and all associated scans, findings, and data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingProject(null)}
              className="text-neutral-300 border-neutral-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              <Trash className="h-4 w-4" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-neutral-100">Edit Project</DialogTitle>
            <DialogDescription className="text-neutral-400">Update project details</DialogDescription>
          </DialogHeader>
          {editingProject && (
            <ProjectForm
              project={editingProject}
              onSave={(data) =>
                updateMutation.mutate({ id: editingProject.id, data })
              }
              onCancel={() => setEditingProject(null)}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
