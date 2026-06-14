import { clsx } from 'clsx'

const severityColors: Record<string, string> = {
  critical: 'bg-red-900/50 text-red-300 border-red-700',
  high: 'bg-orange-900/50 text-orange-300 border-orange-700',
  medium: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  low: 'bg-blue-900/50 text-blue-300 border-blue-700',
  info: 'bg-gray-800 text-gray-300 border-gray-600',
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        severityColors[severity.toLowerCase()] || severityColors.info
      )}
    >
      {severity.toUpperCase()}
    </span>
  )
}