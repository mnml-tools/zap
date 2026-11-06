import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../atoms/Button'

type Props = {
  total?: number
  pageSize: number
  onPageSizeChange: (size: number) => void
  page: number
  filtered: boolean
  disabled: boolean
  onPrevious: () => void
  onNext: () => void
}

export function TablePagination({
  total,
  page,
  pageSize,
  onPageSizeChange,
  filtered,
  disabled,
  onPrevious,
  onNext
}: Props) {
  return (
    <div className="pagination">
      <span>
        {total !== undefined
          ? `${total.toLocaleString()} ${filtered ? 'matching ' : ''}${total === 1 ? 'row' : 'rows'}`
          : '—'}{' '}
        <span className="footer-dot">·</span>
        <label>
          <select
            aria-label="Rows per page"
            value={pageSize}
            disabled={disabled}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[50, 100, 250, 500, 1000].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>{' '}
          per page
        </label>
      </span>
      <div>
        <Button aria-label="Previous page" disabled={!page || disabled} onClick={onPrevious}>
          <ChevronLeft size={16} />
        </Button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil((total || 0) / pageSize))}
        </span>
        <Button
          aria-label="Next page"
          disabled={disabled || total === undefined || (page + 1) * pageSize >= total}
          onClick={onNext}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}
