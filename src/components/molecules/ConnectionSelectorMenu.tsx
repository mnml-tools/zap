import { ConnectionAvatar } from '../atoms/ConnectionAvatar'
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { Connection } from '../../types/connection'
import { driverNames, matchesConnection } from '../../lib/connections'
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
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const available = connections.filter((item) => item.id !== connection.id && matchesConnection(item, search.trim()))
  const active = available[activeIndex] ?? available[0]
  const choose = (item: Connection) => {
    onDismiss()
    trigger.focus()
    onSelect(item)
  }
  const menu = useRef<HTMLDivElement>(null)
  const rect = trigger.getBoundingClientRect()
  const width = Math.min(400, window.innerWidth - 24)
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12))

  useEffect(() => {
    input.current?.focus()

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

  useEffect(() => {
    if (active) document.getElementById(`${id}-option-${active.id}`)?.scrollIntoView({ block: 'nearest' })
  }, [active?.id, id])

  return createPortal(
    <div
      ref={menu}
      id={id}
      className="connection-selector-menu"
      role="dialog"
      aria-label="Switch connection"
      style={{ left, top: rect.bottom + 8, width, maxHeight: Math.max(120, window.innerHeight - rect.bottom - 24) }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (available.length) {
            setActiveIndex(
              (index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length
            )
          }
        } else if (event.key === 'Enter') {
          event.preventDefault()
          if (active && !event.repeat) choose(active)
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
      <label className="connection-selector-search">
        <Search size={14} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-label="Search connections"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={`${id}-results`}
          aria-activedescendant={active ? `${id}-option-${active.id}` : undefined}
          placeholder="Search connections…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setActiveIndex(0)
          }}
        />
      </label>
      <div id={`${id}-results`} role="listbox" aria-label="Available connections">
        {available.map((item, index) => (
          <button
            key={item.id}
            type="button"
            id={`${id}-option-${item.id}`}
            role="option"
            aria-selected={active?.id === item.id}
            tabIndex={-1}
            className="connection-selector-option"
            onPointerMove={() => setActiveIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(item)}
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
      </div>
      {!available.length && (
        <p className="connection-selector-menu-footer" role="status">
          {search ? 'No matching connections.' : 'No other saved connections.'}
        </p>
      )}
      <div className="connection-selector-menu-footer">Switching closes the current connection</div>
    </div>,
    document.body
  )
}
