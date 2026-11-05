import type { ReactNode, Ref } from 'react'
import { Search } from 'lucide-react'

type Props = {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  size?: number
  shortcut?: boolean
  shortcutHint?: ReactNode
  shortcutLabel?: string
  className?: string
  inputRef?: Ref<HTMLInputElement>
}

export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  size = 14,
  shortcut = false,
  shortcutHint,
  shortcutLabel,
  className,
  inputRef
}: Props) {
  return (
    <label className={className ? `search ${className}` : 'search'}>
      <Search size={size} />
      <input
        ref={inputRef}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {shortcutHint ? (
        <kbd className="search-shortcut" aria-label={shortcutLabel} title={shortcutLabel}>
          {shortcutHint}
        </kbd>
      ) : (
        shortcut && <kbd>⌕</kbd>
      )}
    </label>
  )
}
