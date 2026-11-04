import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../atoms/Button'

type Props = {
  total?: number
  page: number
  filtered: boolean
  disabled: boolean
  onPrevious: () => void
  onNext: () => void
}

export function TablePagination({ total, page, filtered, disabled, onPrevious, onNext }: Props) {
  return (
    <div className="pagination">
      <span>
        {total !== undefined
          ? `${total.toLocaleString()} ${filtered ? 'matching ' : ''}${total === 1 ? 'row' : 'rows'}`
          : '—'}{' '}
        <span className="footer-dot">·</span>100 per page
      </span>
      <div>
        <Button aria-label="Previous page" disabled={!page || disabled} onClick={onPrevious}>
          <ChevronLeft size={16} />
        </Button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil((total || 0) / 100))}
        </span>
        <Button
          aria-label="Next page"
          disabled={disabled || total === undefined || (page + 1) * 100 >= total}
          onClick={onNext}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}
