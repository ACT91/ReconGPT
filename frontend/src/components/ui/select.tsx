import * as React from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  id?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  options: SelectOption[]
  disabled?: boolean
  className?: string
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ id, value, defaultValue, onChange, placeholder, options, disabled, className }, ref) => {
    const [open, setOpen] = React.useState(false)
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? value ?? '')
    const selectedValue = value !== undefined ? value : internalValue
    const containerRef = React.useRef<HTMLDivElement>(null)

    const selectedOption = options.find((o) => o.value === selectedValue)

    React.useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
      <div ref={containerRef} className="relative" id={id}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(!open)
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
            {selectedOption ? selectedOption.label : placeholder || 'Select...'}
          </span>
          <CaretDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const newValue = opt.value
                  if (onChange) onChange(newValue)
                  setInternalValue(newValue)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  opt.value === selectedValue
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground',
                )}
              >
                <span className="flex-1 text-left">{opt.label}</span>
                {opt.value === selectedValue && (
                  <Check className="h-3.5 w-3.5 shrink-0" weight="bold" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
