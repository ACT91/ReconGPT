import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  count?: number
}

export function Skeleton({ className, variant = 'text', width, height, count = 1 }: SkeletonProps) {
  const baseClass = 'animate-pulse bg-gray-700/50 rounded'

  const variants = {
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'h-32 w-full rounded-xl',
  }

  const items = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={clsx(baseClass, variants[variant], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  ))

  return <>{items}</>
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-800/50">
          {Array.from({ length: cols }, (_, j) => (
            <div key={j} className="h-4 bg-gray-700/50 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-gray-800/50 rounded-xl p-4 animate-pulse">
          <div className="h-3 w-20 bg-gray-700/50 rounded mb-3" />
          <div className="h-6 w-16 bg-gray-700/50 rounded mb-2" />
          <div className="h-3 w-32 bg-gray-700/50 rounded" />
        </div>
      ))}
    </div>
  )
}
