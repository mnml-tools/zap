import { useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { rowKey } from '../lib/tableState'
import type { Page, TableDraft } from '../types/table'

type Range = { column: number; anchor: number; end: number }
type Menu = { range: Range; x: number; y: number; trigger: HTMLElement }

export function useColumnSelection(data: Page, draft?: TableDraft) {
  const [range, setRange] = useState<Range>()
  const [menu, setMenu] = useState<Menu>()
  const [error, setError] = useState('')

  function start(event: PointerEvent<HTMLElement>, column: number, row: number) {
    if (event.button !== 0) return

    if (event.pointerType === 'mouse') {
      event.preventDefault()
      window.getSelection()?.removeAllRanges()
      event.currentTarget.focus({ preventScroll: true })
    }

    setRange((current) =>
      event.shiftKey && current?.column === column ? { ...current, end: row } : { column, anchor: row, end: row }
    )
  }

  function extend(event: PointerEvent, column: number, row: number) {
    if (event.pointerType !== 'mouse' || !(event.buttons & 1)) return

    setRange((current) => (current?.column === column ? { ...current, end: row } : current))
  }

  function includes(column: number, row: number) {
    return (
      range?.column === column && row >= Math.min(range.anchor, range.end) && row <= Math.max(range.anchor, range.end)
    )
  }

  function openMenu(event: MouseEvent<HTMLElement>, column: number, row?: number) {
    event.preventDefault()

    const selection =
      row === undefined
        ? { column, anchor: 0, end: data.rows.length - 1 }
        : range && includes(column, row)
          ? range
          : { column, anchor: row, end: row }
    const bounds = event.currentTarget.getBoundingClientRect()

    setRange(selection)
    setMenu({
      range: selection,
      x: event.clientX || bounds.left,
      y: event.clientY || bounds.bottom,
      trigger: event.currentTarget
    })
  }

  async function copy() {
    if (!menu) return

    const { column, anchor, end } = menu.range
    const text = data.rows
      .slice(Math.min(anchor, end), Math.max(anchor, end) + 1)
      .map((row) => {
        const changes = draft?.rows[rowKey(row, data)]?.changes
        const value = changes && Object.hasOwn(changes, column) ? changes[column] : row[column]
        return value === null ? 'NULL' : /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
      })
      .join(',')

    setMenu(undefined)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError('Could not copy column values to the clipboard.')
    }
  }

  return {
    start,
    extend,
    includes,
    openMenu,
    menu,
    dismissMenu: () => setMenu(undefined),
    copy,
    error,
    dismissError: () => setError('')
  }
}
