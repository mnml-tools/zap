import { List, ListTree, Table2 } from 'lucide-react'
import type { TableMode } from '../../types/table'
import { Button } from '../atoms/Button'

const modes = [
  { value: 'data', label: 'Data', icon: Table2 },
  { value: 'structure', label: 'Structure', icon: ListTree },
  { value: 'indexes', label: 'Indexes', icon: List }
] as const

type Props = { mode: TableMode; available: readonly TableMode[]; onChange: (mode: TableMode) => void }

export function TableViewSwitch({ mode, available, onChange }: Props) {
  return (
    <div className="table-view-bar">
      <div className="view-switch table-view-switch" role="group" aria-label="Table view">
        {modes
          .filter(({ value }) => available.includes(value))
          .map(({ value, label, icon: Icon }) => (
            <Button key={value} aria-pressed={mode === value} onClick={() => onChange(value)}>
              <Icon size={13} aria-hidden="true" />
              {label}
            </Button>
          ))}
      </div>
    </div>
  )
}
