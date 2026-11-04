import { Table2, FileCode2 } from 'lucide-react'
import { Button } from '../atoms/Button'

export function SidebarSwitch({
  value,
  onChange
}: {
  value: 'tables' | 'queries'
  onChange: (value: 'tables' | 'queries') => void
}) {
  return (
    <div className="view-switch sidebar-switch" role="tablist" aria-label="Sidebar content">
      <Button role="tab" aria-selected={value === 'tables'} onClick={() => onChange('tables')}>
        <Table2 size={13} />
        Tables
      </Button>
      <Button role="tab" aria-selected={value === 'queries'} onClick={() => onChange('queries')}>
        <FileCode2 size={13} />
        Queries
      </Button>
    </div>
  )
}
