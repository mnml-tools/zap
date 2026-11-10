import { useCallback, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { rowKey } from '../lib/tableState'
import type { Page, TableDraft } from '../types/table'

type Range = { column: number; anchor: number; end: number; mode: 'cells' | 'rows' }
type Menu = { row?: number; range: Range; x: number; y: number; trigger: HTMLElement }

export function useColumnSelection(data: Page, draft?: TableDraft) {
  const [range, setRange] = useState<Range>()
  const [menu, setMenu] = useState<Menu>()
  const [error, setError] = useState('')
  const clear = useCallback(() => {
    setRange(undefined)
    setMenu(undefined)
  }, [])

  function start(event: PointerEvent<HTMLElement>, column: number, row: number, mode: Range['mode'] = 'cells') {
    if (event.button !== 0) return

    if (event.pointerType === 'mouse') {
      event.preventDefault()
      window.getSelection()?.removeAllRanges()
      event.currentTarget.focus({ preventScroll: true })
    }

    setRange((current) =>
      event.shiftKey && current?.mode === mode && (mode === 'rows' || current.column === column)
        ? { ...current, end: row }
        : { column, anchor: row, end: row, mode }
    )
  }

  function selectRow(column: number, row: number, extend = false) {
    setRange((current) =>
      extend && current?.mode === 'rows' ? { ...current, end: row } : { column, anchor: row, end: row, mode: 'rows' }
    )
  }

  function extend(event: PointerEvent, column: number, row: number, mode: Range['mode'] = 'cells') {
    if (event.pointerType !== 'mouse' || !(event.buttons & 1)) return

    setRange((current) =>
      current?.mode === mode && (mode === 'rows' || current.column === column) ? { ...current, end: row } : current
    )
  }

  function includes(column: number, row: number) {
    return range?.mode === 'cells' && range.column === column && includesRow(row)
  }

  function includesRow(row: number) {
    return !!range && row >= Math.min(range.anchor, range.end) && row <= Math.max(range.anchor, range.end)
  }

  function openMenu(event: MouseEvent<HTMLElement>, column: number, row?: number, rows = false) {
    event.preventDefault()

    const selection =
      row === undefined
        ? { column, anchor: 0, end: data.rows.length - 1, mode: 'cells' as const }
        : range && includesRow(row) && (rows || range.mode === 'rows' || range.column === column)
          ? { ...range, column, mode: rows ? ('rows' as const) : ('cells' as const) }
          : { column, anchor: row, end: row, mode: rows ? ('rows' as const) : ('cells' as const) }
    const bounds = event.currentTarget.getBoundingClientRect()

    setRange(selection)
    setMenu({
      row,
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
    clear,
    selectCell: (column: number, row: number) =>
      setRange(row < data.rows.length ? { column, anchor: row, end: row, mode: 'cells' } : undefined),
    selectedRows: data.rows.filter((_, index) => includesRow(index)),
    column: range?.column,
    start,
    extend,
    includes,
    includesRow,
    selectRow,
    openMenu,
    menu,
    dismissMenu: () => setMenu(undefined),
    copy,
    error,
    dismissError: () => setError('')
  }
}
