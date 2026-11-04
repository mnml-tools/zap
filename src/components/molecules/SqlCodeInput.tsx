import { useMemo, useRef } from 'react'
import { highlightSql } from '../../lib/sqlHighlight'

type Props = { value: string; disabled: boolean; onChange: (value: string) => void }

export function SqlCodeInput({ value, disabled, onChange }: Props) {
  const gutter = useRef<HTMLPreElement>(null),
    highlight = useRef<HTMLPreElement>(null)
  const tokens = useMemo(() => highlightSql(value), [value])

  return (
    <div className="query-code">
      <pre ref={gutter} className="query-gutter" aria-hidden="true">
        {Array.from({ length: Math.max(12, value.split('\n').length) }, (_, i) => i + 1).join('\n')}
      </pre>
      <div className="sql-source">
        <pre ref={highlight} className="sql-highlight" aria-hidden="true">
          {tokens.map((token, index) => (
            <span key={index} className={`sql-${token.kind}`}>
              {token.text}
            </span>
          ))}
          {'\n'}
        </pre>
        <textarea
          className="sql-input"
          wrap="off"
          aria-label="SQL query"
          placeholder="SELECT * FROM your_table LIMIT 100;"
          value={value}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop

            if (highlight.current) {
              highlight.current.scrollTop = event.currentTarget.scrollTop
              highlight.current.scrollLeft = event.currentTarget.scrollLeft
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Tab' && !event.shiftKey) {
              event.preventDefault()
              const input = event.currentTarget,
                start = input.selectionStart,
                end = input.selectionEnd
              onChange(value.slice(0, start) + '  ' + value.slice(end))
              requestAnimationFrame(() => {
                input.selectionStart = input.selectionEnd = start + 2
              })
            }
          }}
        />
      </div>
    </div>
  )
}
