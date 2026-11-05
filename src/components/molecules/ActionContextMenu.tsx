import { createPortal } from 'react-dom'
import { useContextMenu } from '../../hooks/useContextMenu'
import { Button } from '../atoms/Button'

type Action = { label: string; shortcut?: string; disabled: boolean; run: () => void }

type Props = {
  title: string
  x: number
  y: number
  actions: Action[]
  onDismiss: () => void
  above?: boolean
  trigger?: HTMLElement
}

export function ActionContextMenu({ title, x, y, actions, onDismiss, above, trigger }: Props) {
  const menu = useContextMenu(onDismiss, trigger)

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={`Actions for ${title}`}
      className="connection-menu tab-context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 234)),
        ...(above ? { bottom: window.innerHeight - y } : { top: Math.max(4, Math.min(y, window.innerHeight - 152)) })
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {actions.map(({ label, shortcut, disabled, run }) => (
        <Button key={label} type="button" role="menuitem" disabled={disabled} onClick={run}>
          <span>{label}</span>
          {shortcut && <kbd className="menu-shortcut">{shortcut}</kbd>}
        </Button>
      ))}
    </div>,
    document.body
  )
}
