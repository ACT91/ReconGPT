import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '@/types'

interface ProjectState {
  selectedProject: Project | null
  setSelectedProject: (project: Project | null) => void
  clearProject: () => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedProject: null,
      setSelectedProject: (project) => set({ selectedProject: project }),
      clearProject: () => set({ selectedProject: null }),
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({ selectedProject: state.selectedProject }),
    }
  )
)
