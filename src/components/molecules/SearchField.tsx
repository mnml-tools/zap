import { Search } from 'lucide-react'

type Props = {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  size?: number
  shortcut?: boolean
}

export function SearchField({ label, placeholder, value, onChange, size = 14, shortcut = false }: Props) {
  return (
    <label className="search">
      <Search size={size} />
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {shortcut && <kbd>⌕</kbd>}
    </label>
  )
}
