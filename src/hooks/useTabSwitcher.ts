import { useEffect, useRef, useState } from 'react'
import { isSwitchRelease, isTabSwitch, recentTabs, stepTab, touchTab } from '../lib/tabSwitcher'

type Switcher = { order: string[]; index: number }

type Options = { keys: string[]; active: string; disabled: boolean; onSelect: (key: string) => void }

// Ctrl+Tab opens a most recently used list, like JetBrains IDEs. Tab and Shift+Tab move while
// Ctrl is held, and releasing Ctrl switches to the highlighted tab. Ctrl is used on macOS too.
export function useTabSwitcher({ keys, active, disabled, onSelect }: Options) {
  const [switcher, setSwitcher] = useState<Switcher>()
  const state = useRef<Switcher>(undefined)
  const popup = useRef<HTMLDivElement>(null)
  const history = useRef<string[]>([])
  const current = useRef({ keys, disabled, onSelect })
  current.current = { keys, disabled, onSelect }

  useEffect(() => {
    history.current = touchTab(history.current, active)
  }, [active])

  const update = (next?: Switcher) => {
    state.current = next
    setSwitcher(next)
  }

  const pick = (index: number) => {
    const key = state.current?.order[index]
    update()

    if (!key || current.current.disabled || !current.current.keys.includes(key)) return

    // Match a click on the tab: leave the focused field first so it commits and does not stay
    // focused inside a pane that is about to be hidden.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    current.current.onSelect(key)
  }

  useEffect(() => {
    const swallow = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }

    const keydown = (event: KeyboardEvent) => {
      const open = state.current

      if (!open) {
        if (!isTabSwitch(event) || event.isComposing || document.querySelector('dialog[open], [aria-modal="true"]')) {
          return
        }

        swallow(event)
        const order = recentTabs(current.current.keys, history.current)
        if (order.length && !current.current.disabled)
          update({ order, index: stepTab(0, order.length, event.shiftKey) })

        return
      }

      // Ctrl was released without a keyup reaching the page, so finish the switch first.
      if (!event.ctrlKey) {
        pick(open.index)

        return
      }

      // Swallow everything while open so other shortcuts cannot act on the tab being left.
      swallow(event)

      if (event.key === 'Escape') update()
      else if (event.key === 'Enter') pick(open.index)
      else if (event.key === 'Tab' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const backwards = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)
        update({ ...open, index: stepTab(open.index, open.order.length, backwards) })
      }
    }

    const keyup = (event: KeyboardEvent) => {
      if (!state.current || !isSwitchRelease(event)) return

      swallow(event)
      pick(state.current.index)
    }

    const cancel = () => state.current && update()

    // A click outside closes without switching and still reaches what was clicked.
    const pointerdown = (event: PointerEvent) => {
      if (state.current && !popup.current?.contains(event.target as Node)) update()
    }

    window.addEventListener('keydown', keydown, true)
    window.addEventListener('keyup', keyup, true)
    window.addEventListener('pointerdown', pointerdown, true)
    window.addEventListener('blur', cancel)

    return () => {
      window.removeEventListener('keydown', keydown, true)
      window.removeEventListener('keyup', keyup, true)
      window.removeEventListener('pointerdown', pointerdown, true)
      window.removeEventListener('blur', cancel)
    }
  }, [])

  return {
    switcher,
    popup,
    hover: (index: number) => state.current && update({ ...state.current, index }),
    pick
  }
}
