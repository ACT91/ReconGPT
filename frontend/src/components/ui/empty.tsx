import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'inline'
}

function Empty({ className, variant = 'default', ...props }: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        variant === 'inline' && 'py-6',
        className,
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col items-center gap-2 mb-4', className)}
      {...props}
    />
  )
}

function EmptyMedia({ className, children, variant = 'icon', ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: 'icon' | 'image' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        variant === 'icon' && 'h-12 w-12 rounded-full bg-neutral-800/50 text-neutral-500 mb-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function EmptyTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold text-neutral-100', className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-neutral-500 max-w-sm', className)}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col items-center gap-3 mt-2', className)}
      {...props}
    />
  )
}

export { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent }
