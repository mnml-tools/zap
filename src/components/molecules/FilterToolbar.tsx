import { Plus, X } from 'lucide-react'
import { Button } from '../atoms/Button'

type Props = {
  disabled: boolean
  canAdd: boolean
  canClear: boolean
  canApply: boolean
  changed: boolean
  onAdd: () => void
  onClear: () => void
  onApply: () => void
  onHide: () => void
}

export function FilterToolbar(props: Props) {
  return (
    <div className="filter-footer">
      <div>
        <Button disabled={props.disabled || !props.canAdd} onClick={props.onAdd}>
          <Plus size={12} />
          Add filter
        </Button>
        <span>{props.changed ? 'Unapplied changes' : 'All enabled conditions match (AND)'}</span>
      </div>
      <div>
        <Button disabled={props.disabled || !props.canClear} onClick={props.onClear}>
          Clear
        </Button>
        <Button className="primary" disabled={props.disabled || !props.canApply} onClick={props.onApply}>
          Apply all
        </Button>
        <Button aria-label="Hide filters" title="Hide filters (Escape)" onClick={props.onHide}>
          <X size={13} />
        </Button>
      </div>
    </div>
  )
}
