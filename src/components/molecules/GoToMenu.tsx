import { useEffect, useMemo, useRef, useState } from 'react'
import { FileCode2, Search } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { SavedQuery } from '../../types/query'
import type { Table } from '../../types/table'
import { goToScopes, searchGoTo } from '../../lib/goTo'
import type { GoToItem, GoToScope } from '../../lib/goTo'
import { HighlightedText } from '@mnml-tools/ui'
import { TableIcon } from '../atoms/TableIcon'

const visibleLimit = 100

const placeholders: Record<GoToScope, string> = {
  all: 'Search tables, views, and queries…',
  tables: 'Search tables…',
  queries: 'Search queries…',
  views: 'Search views…'
}

const emptyMessages: Record<GoToScope, string> = {
  all: 'No matching tables, views, or queries.',
  tables: 'No matching tables.',
  queries: 'No matching queries.',
  views: 'No matching views.'
}

type Props = {
  id: string
  connectionTitle: string
  tables: Table[]
  queries: SavedQuery[]
  search: string
  scope: GoToScope
  onSearch: (search: string) => void
  onScope: (scope: GoToScope) => void
  onDismiss: (restoreFocus: boolean) => void
  onChoose: (item: GoToItem) => void
}

export function GoToMenu(props: Props) {
  const { id, tables, queries, search, scope, onSearch, onScope, onDismiss, onChoose } = props

  const [activeIndex, setActiveIndex] = useState(0)
  const menu = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchGoTo(tables, queries, scope, search), [tables, queries, scope, search])
  const visible = results.slice(0, visibleLimit)
  const active = Math.min(activeIndex, visible.length - 1)
  const width = Math.min(680, window.innerWidth - 24)

  const changeScope = (step: number) => {
    const index = goToScopes.findIndex((item) => item.value === scope)
    onScope(goToScopes[(index + step + goToScopes.length) % goToScopes.length].value)
    setActiveIndex(0)
  }

  useEffect(() => {
    input.current?.focus()
    input.current?.select()

    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onDismiss(false)
    }
    const resize = () => onDismiss(false)
    window.addEventListener('pointerdown', outside)
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', resize)
    }
  }, [onDismiss])

  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, id, results])

  return createPortal(
    <div
      ref={menu}
      id={id}
      className="go-to-menu"
      role="dialog"
      aria-label="Go to table or query"
      style={{ width, left: (window.innerWidth - width) / 2 }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (visible.length) {
            setActiveIndex((event.key === 'ArrowDown' ? active + 1 : active - 1 + visible.length) % visible.length)
          }
        } else if (event.key === 'Enter') {
          event.preventDefault()
          if (visible[active] && !event.repeat) onChoose(visible[active])
        } else if (event.key === 'Tab') {
          event.preventDefault()
          changeScope(event.shiftKey ? -1 : 1)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onDismiss(true)
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) onDismiss(false)
      }}
    >
      <div className="go-to-toolbar">
        <div className="go-to-scopes" role="tablist" aria-label="Search in">
          {goToScopes.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={scope === item.value}
              aria-controls={`${id}-results`}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onScope(item.value)
                setActiveIndex(0)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="go-to-connection" title={props.connectionTitle}>
          {props.connectionTitle}
        </span>
      </div>
      <label className="go-to-search">
        <Search size={14} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-label={placeholders[scope].slice(0, -1)}
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={`${id}-results`}
          aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
          placeholder={placeholders[scope]}
          spellCheck={false}
          autoComplete="off"
          value={search}
          onChange={(event) => {
            onSearch(event.target.value)
            setActiveIndex(0)
          }}
        />
        <kbd title="Press Tab to switch between All, Tables, and Queries">Tab</kbd>
      </label>
      <div id={`${id}-results`} className="go-to-results" role="listbox" aria-label="Results">
        {visible.map((item, index) => (
          <button
            key={item.key}
            type="button"
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={active === index}
            tabIndex={-1}
            className="go-to-option"
            onPointerMove={() => setActiveIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(item)}
          >
            {item.kind === 'table' ? (
              <TableIcon table={item.table} size={14} />
            ) : (
              <FileCode2 size={14} aria-hidden="true" />
            )}
            <HighlightedText className="go-to-label" text={item.label} indices={item.matches} />
            {item.kind === 'table' ? (
              item.table.schema && (
                <HighlightedText className="go-to-detail" text={item.table.schema} indices={item.schemaMatches} />
              )
            ) : (
              <span className="go-to-detail">saved query</span>
            )}
          </button>
        ))}
      </div>
      {(!visible.length || results.length > visible.length) && (
        <p className="go-to-footer" role="status">
          {visible.length
            ? `Showing ${visible.length} of ${results.length} results. Keep typing to narrow them down.`
            : emptyMessages[scope]}
        </p>
      )}
    </div>,
    document.body
  )
}
