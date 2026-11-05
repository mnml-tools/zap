import type { KeyboardEvent } from 'react'

type Options = {
  disabled: boolean
  onSelect: (row: number, column: number) => void
}

export function useTableNavigation({ disabled, onSelect }: Options) {
  return (event: KeyboardEvent<HTMLTableElement>) => {
    if (disabled || event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
    if (
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement) &&
      !(event.target instanceof HTMLSelectElement)
    )
      return

    const cell = event.target.closest<HTMLTableCellElement>('tbody td:not(.row-number)')
    if (!cell) return

    const cells = Array.from(event.currentTarget.querySelectorAll<HTMLTableCellElement>('tbody td:not(.row-number)'))
    const index = cells.indexOf(cell)
    const candidates = event.shiftKey ? cells.slice(0, index).reverse() : cells.slice(index + 1)
    const next = candidates.find((candidate) => candidate.classList.contains('editable-cell'))

    if (!next) return

    event.preventDefault()
    event.stopPropagation()
    event.target.blur()
    onSelect((next.parentElement as HTMLTableRowElement).sectionRowIndex, next.cellIndex - 1)
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}
