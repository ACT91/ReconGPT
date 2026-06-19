import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { scanApi } from '@/services/api'
import { useProjectStore } from '@/store/project'
import type { ScanJob } from '@/types'

interface ScanSelectorProps {
  value: string
  onChange: (scanId: string) => void
  label?: string
}

export function ScanSelector({ value, onChange, label = 'Scan' }: ScanSelectorProps) {
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const [localInput, setLocalInput] = useState(value || '')

  useEffect(() => {
    if (value && value !== localInput) {
      setLocalInput(value)
    }
  }, [value])

  const { data: scansData } = useQuery({
    queryKey: ['scans-list', selectedProject?.id],
    queryFn: () =>
      scanApi.list({
        page_size: 100,
        ...(selectedProject?.id ? { project_id: selectedProject.id } : {}),
      }),
  })

  const scans = scansData?.items || []

  const handleInputApply = () => {
    if (localInput.trim()) {
      onChange(localInput.trim())
    }
  }

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        {scans.length > 0 && (
          <select
            value={value}
            onChange={(e) => {
              setLocalInput(e.target.value)
              onChange(e.target.value)
            }}
            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2.5 text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select a {label}...</option>
            {scans.map((scan: ScanJob) => (
              <option key={scan.id} value={scan.id}>
                [{scan.target_domain}] {scan.status} — {new Date(scan.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        )}
        {scans.length === 0 && (
          <input
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInputApply()}
            placeholder={`Enter ${label} ID...`}
            className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2.5 text-neutral-100 placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}
      </div>
      <button
        onClick={handleInputApply}
        className="px-3 py-2.5 bg-primary text-sidebar-bg hover:bg-primary/90 rounded-lg text-sm whitespace-nowrap"
      >
        Load
      </button>
    </div>
  )
}
