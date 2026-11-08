import { useCallback, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Connection } from '../../types/connection'
import { orderConnections } from '../../lib/connectionOrder'
import { formatShortcut, switchConnectionShortcut } from '../../lib/shortcuts'
import { ConnectionSelectorMenu } from './ConnectionSelectorMenu'
import { ConnectionSummary } from './ConnectionSummary'
import { useShortcut } from '@mnml-tools/ui'

type Props = {
  connection: Connection
  connections: Connection[]
  disabled: boolean
  onSelect: (connection: Connection) => void
}

export function ConnectionSelector({ connection, connections, disabled, onSelect }: Props) {
  const ordered = orderConnections(connections)

  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const dismiss = useCallback(() => setOpen(false), [])

  useShortcut(switchConnectionShortcut, !disabled, () => setOpen(true))

  return (
    <div className="connection-selector">
      <button
        ref={trigger}
        type="button"
        className="connection-selector-trigger"
        aria-label={`Switch connection: ${connection.title}`}
        title={`Switch connection (${formatShortcut(switchConnectionShortcut)})`}
        aria-keyshortcuts="Control+P Meta+P"
        aria-haspopup="dialog"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <ConnectionSummary connection={connection} />
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && !disabled && trigger.current && (
        <ConnectionSelectorMenu
          id={menuId}
          connection={connection}
          connections={ordered}
          trigger={trigger.current}
          onDismiss={dismiss}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}
