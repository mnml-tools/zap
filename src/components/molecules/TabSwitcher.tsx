import { useEffect, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTabSwitcher } from '../../hooks/useTabSwitcher'
import type { TabPreview } from '../../lib/tabPreview'
import { DirtyIndicator } from '../atoms/DirtyIndicator'
import { TabPreviewPane } from './TabPreviewPane'

export type SwitchableTab = {
  key: string
  title: string
  icon: ReactNode
  dirty: boolean
  select: () => void
  preview: () => TabPreview
}

type Props = {
  tabs: SwitchableTab[]
  active: string
  disabled: boolean
  subscribe?: (listener: () => void) => () => void
}

export function TabSwitcher({ tabs, active, disabled, subscribe }: Props) {
  const list = useRef<HTMLUListElement>(null)
  const [, refresh] = useReducer((count: number) => count + 1, 0)
  const { switcher, popup, hover, pick } = useTabSwitcher({
    keys: tabs.map((tab) => tab.key),
    active,
    disabled,
    onSelect: (key) => tabs.find((tab) => tab.key === key)?.select()
  })

  const open = !!switcher

  // Only listen for preview changes while the switcher is on screen.
  useEffect(() => (open && subscribe ? subscribe(refresh) : undefined), [open, subscribe])

  useEffect(() => {
    list.current?.children[switcher?.index ?? -1]?.scrollIntoView({ block: 'nearest' })
  }, [switcher?.index])

  if (!switcher) return null

  const highlighted = tabs.find((tab) => tab.key === switcher.order[switcher.index])

  return createPortal(
    <div ref={popup} className="tab-switcher" onMouseDown={(event) => event.preventDefault()}>
      <p id="tab-switcher-title">Open tabs</p>
      <div className="tab-switcher-body">
        <ul ref={list} role="listbox" aria-labelledby="tab-switcher-title">
          {switcher.order.map((key, index) => {
            const tab = tabs.find((item) => item.key === key)
            if (!tab) return null

            return (
              <li
                key={key}
                role="option"
                aria-selected={index === switcher.index}
                className={index === switcher.index ? 'active' : undefined}
                onMouseMove={() => index !== switcher.index && hover(index)}
                onClick={() => pick(index)}
              >
                {tab.icon}
                <span>{tab.title}</span>
                {tab.dirty && <DirtyIndicator />}
              </li>
            )
          })}
        </ul>
        {highlighted && (
          <TabPreviewPane title={highlighted.title} icon={highlighted.icon} preview={highlighted.preview()} />
        )}
      </div>
    </div>,
    document.body
  )
}
