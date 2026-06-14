import { clsx } from 'clsx'

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    queued: { color: 'bg-gray-800 text-gray-300', label: 'Queued' },
    running: { color: 'bg-blue-900/50 text-blue-300', label: 'Running' },
    completed: { color: 'bg-green-900/50 text-green-300', label: 'Completed' },
    failed: { color: 'bg-red-900/50 text-red-300', label: 'Failed' },
    cancelled: { color: 'bg-yellow-900/50 text-yellow-300', label: 'Cancelled' },
    partial: { color: 'bg-orange-900/50 text-orange-300', label: 'Partial' },
  }
  const c = config[status] || { color: 'bg-gray-800 text-gray-300', label: status }

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        c.color
      )}
    >
      {status === 'running' && (
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5 animate-pulse" />
      )}
      {c.label}
    </span>
  )
}