import { ConnectionAvatar } from '../atoms/ConnectionAvatar'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Connection } from '../../types/connection'
import { driverNames } from '../../lib/connections'
import { ConnectionEnvironmentBadge } from '../atoms/ConnectionEnvironmentBadge'

type Props = {
  id: string
  connection: Connection
  connections: Connection[]
  trigger: HTMLButtonElement
  onDismiss: () => void
  onSelect: (connection: Connection) => void
}

export function ConnectionSelectorMenu({ id, connection, connections, trigger, onDismiss, onSelect }: Props) {
  const available = connections.filter((item) => item.id !== connection.id)
  const menu = useRef<HTMLDivElement>(null)
  const rect = trigger.getBoundingClientRect()
  const width = Math.min(320, window.innerWidth - 24)
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12))

  useEffect(() => {
    const first = menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
    ;(first ?? menu.current)?.focus()

    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.contains(event.target as Node)) onDismiss()
    }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('resize', onDismiss)

    return () => {
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', onDismiss)
    }
  }, [trigger, onDismiss])

  return createPortal(
    <div
      ref={menu}
      id={id}
      className="connection-selector-menu"
      role="menu"
      tabIndex={-1}
      aria-label="Switch connection"
      style={{ left, top: rect.bottom + 8, width, maxHeight: Math.max(120, window.innerHeight - rect.bottom - 24) }}
      onKeyDown={(event) => {
        const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
        const index = items.indexOf(document.activeElement as HTMLButtonElement)

        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? items.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          items[next]?.focus()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onDismiss()
          trigger.focus()
        } else if (event.key === 'Tab') {
          onDismiss()
          trigger.focus()
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) onDismiss()
      }}
    >
      <div className="connection-selector-menu-heading">
        <span>Switch connection</span>
        <span>{available.length} available</span>
      </div>
      {available.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="connection-selector-option"
          onClick={() => {
            onDismiss()
            trigger.focus()
            onSelect(item)
          }}
        >
          <ConnectionAvatar connection={item} />
          <span className="connection-selector-details">
            <strong>{item.title}</strong>
            <span>
              {driverNames[item.driver] ?? item.driver} ·{' '}
              {item.driver === 'sqlite' ? item.database : `${item.host}:${item.port}`}
            </span>
          </span>
          <ConnectionEnvironmentBadge environment={item.environment} />
        </button>
      ))}
      {!available.length && <p className="connection-selector-menu-footer">No other saved connections.</p>}
      <div className="connection-selector-menu-footer">Switching closes the current connection</div>
    </div>,
    document.body
  )
}
