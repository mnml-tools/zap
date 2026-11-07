import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTabSwitcher } from '../../hooks/useTabSwitcher'
import { DirtyIndicator } from '../atoms/DirtyIndicator'

export type SwitchableTab = { key: string; title: string; icon: ReactNode; dirty: boolean; select: () => void }

type Props = { tabs: SwitchableTab[]; active: string; disabled: boolean }

export function TabSwitcher({ tabs, active, disabled }: Props) {
  const list = useRef<HTMLUListElement>(null)
  const { switcher, hover, pick } = useTabSwitcher({
    keys: tabs.map((tab) => tab.key),
    active,
    disabled,
    onSelect: (key) => tabs.find((tab) => tab.key === key)?.select()
  })

  useEffect(() => {
    list.current?.children[switcher?.index ?? -1]?.scrollIntoView({ block: 'nearest' })
  }, [switcher?.index])

  if (!switcher) return null

  return createPortal(
    <div className="tab-switcher" onMouseDown={(event) => event.preventDefault()}>
      <p id="tab-switcher-title">Open tabs</p>
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
    </div>,
    document.body
  )
}
