import { Pagination, Separator } from '@mnml-tools/ui'

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
    <Pagination
      page={page}
      pageCount={total === undefined ? 0 : Math.ceil(total / pageSize)}
      disabled={disabled}
      onPrevious={onPrevious}
      onNext={onNext}
      summary={
        <>
          {total !== undefined
            ? `${total.toLocaleString()} ${filtered ? 'matching ' : ''}${total === 1 ? 'row' : 'rows'}`
            : '—'}{' '}
          <Separator />
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
        </>
      }
    />
  )
}
