import { clsx } from 'clsx'

interface ScanProgressBarProps {
  progress: number
  status?: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function ScanProgressBar({ progress, status, size = 'md', showLabel = true }: ScanProgressBarProps) {
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }
  const isRunning = status === 'running' || status === 'queued'
  const isError = status === 'failed' || status === 'cancelled'

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className={clsx('w-full bg-gray-800 rounded-full overflow-hidden', heights[size])}>
        <div
          className={clsx(
            heights[size],
            'rounded-full transition-all duration-500 ease-out',
            isError ? 'bg-red-500' : isRunning ? 'bg-blue-500' : 'bg-green-500'
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  )
}