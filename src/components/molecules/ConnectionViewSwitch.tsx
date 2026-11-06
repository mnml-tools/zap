import { LayoutGrid, List } from 'lucide-react'
import type { ConnectionView } from '../../hooks/useConnectionView'
import { Button } from '../atoms/Button'

type Props = { view: ConnectionView; onChange: (view: ConnectionView) => void }

export function ConnectionViewSwitch({ view, onChange }: Props) {
  return (
    <div className="view-switch connection-view-switch" role="group" aria-label="Connection view">
      <Button title="List view" aria-label="List view" aria-pressed={view === 'list'} onClick={() => onChange('list')}>
        <List size={14} />
        List
      </Button>
      <Button title="Grid view" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => onChange('grid')}>
        <LayoutGrid size={14} />
        Grid
      </Button>
    </div>
  )
}
