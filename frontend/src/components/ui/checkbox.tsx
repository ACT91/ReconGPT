import * as React from 'react'
import { Check } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, id, label, checked, onChange, disabled, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={cn(
          'flex items-center gap-2 cursor-pointer',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
            {...props}
          />
          <div
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded border border-input bg-background transition-colors',
              'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
              checked
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:border-muted-foreground',
              disabled && 'opacity-50',
            )}
          >
            {checked && <Check className="h-3 w-3" weight="bold" />}
          </div>
        </div>
        {label && (
          <span className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </span>
        )}
      </label>
    )
  },
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
