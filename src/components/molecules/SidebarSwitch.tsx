import { Table2, FileCode2 } from 'lucide-react'
import { Button, Segmented } from '@mnml-tools/ui'

export function SidebarSwitch({
  value,
  onChange
}: {
  value: 'tables' | 'queries'
  onChange: (value: 'tables' | 'queries') => void
}) {
  return (
    <Segmented className="sidebar-switch" role="tablist" label="Sidebar content">
      <Button role="tab" aria-selected={value === 'tables'} onClick={() => onChange('tables')}>
        <Table2 size={13} />
        Tables
      </Button>
      <Button role="tab" aria-selected={value === 'queries'} onClick={() => onChange('queries')}>
        <FileCode2 size={13} />
        Queries
      </Button>
    </Segmented>
  )
}
