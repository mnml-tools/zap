import { LayoutGrid, List } from 'lucide-react'
import type { ConnectionView } from '../../hooks/useConnectionView'
import { Button, Segmented } from '@mnml-tools/ui'

type Props = { view: ConnectionView; onChange: (view: ConnectionView) => void }

export function ConnectionViewSwitch({ view, onChange }: Props) {
  return (
    <Segmented className="connection-view-switch" label="Connection view">
      <Button title="List view" aria-label="List view" aria-pressed={view === 'list'} onClick={() => onChange('list')}>
        <List size={14} />
        List
      </Button>
      <Button title="Grid view" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => onChange('grid')}>
        <LayoutGrid size={14} />
        Grid
      </Button>
    </Segmented>
  )
}
