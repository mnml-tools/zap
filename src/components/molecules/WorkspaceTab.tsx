import type { MouseEventHandler, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '../atoms/Button'
import { DirtyIndicator } from '../atoms/DirtyIndicator'

type Props = {
  title: string
  icon: ReactNode
  active: boolean
  dirty: boolean
  disabled: boolean
  closeDisabled?: boolean
  closeLabel: string
  onSelect: () => void
  onClose: () => void
  onContextMenu?: MouseEventHandler<HTMLDivElement>
}

export function WorkspaceTab({
  title,
  icon,
  active,
  dirty,
  disabled,
  closeDisabled = disabled,
  closeLabel,
  onSelect,
  onClose,
  onContextMenu
}: Props) {
  return (
    <div className={active ? 'tab active' : 'tab'} onContextMenu={onContextMenu}>
      <Button disabled={disabled} onClick={onSelect}>
        {icon}
        {title}
        {dirty && <DirtyIndicator />}
      </Button>
      <Button aria-label={closeLabel} disabled={closeDisabled} onClick={onClose}>
        <X size={13} />
      </Button>
    </div>
  )
}
