import { editorPreferences } from '../../services/editorPreferences'
import {
  useId,
  useSyncExternalStore,
  type CSSProperties,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { highlightSql } from '../../lib/sqlHighlight'
import { formatSql, formattedPosition } from '../../lib/sqlFormat'
import { isFormatQueryShortcut } from '../../lib/shortcuts'
import type { Completion, CompletionItem } from '../../lib/sqlCompletion'
import { SqlCompletionList } from './SqlCompletionList'

type Props = {
  value: string
  disabled: boolean
  onChange: (value: string) => void
  complete?: (sql: string, cursor: number) => Completion | null
}

const caretKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

let measure: CanvasRenderingContext2D | null = null

export function SqlCodeInput({ value, disabled, onChange, complete }: Props) {
  const preferences = useSyncExternalStore(editorPreferences.subscribe, editorPreferences.getSnapshot)
  const gutter = useRef<HTMLPreElement>(null),
    highlight = useRef<HTMLPreElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    list = useRef<HTMLUListElement>(null),
    accepting = useRef(false)
  const [suggesting, setSuggesting] = useState(false),
    [cursor, setCursor] = useState(0),
    [selection, setSelection] = useState({ key: '', index: 0 })
  const [, rerender] = useReducer((count: number) => count + 1, 0)
  const listId = useId()
  const tokens = useMemo(() => highlightSql(value), [value])
  const completion = useMemo(
    () => (suggesting && complete && !disabled ? complete(value, cursor) : null),
    [suggesting, complete, disabled, value, cursor]
  )
  const completionKey = completion ? `${completion.start}:${completion.prefix}` : ''
  const active = selection.key === completionKey ? selection.index : 0

  useLayoutEffect(() => {
    const element = list.current,
      textarea = input.current

    if (!element || !textarea || !completion) return

    const style = getComputedStyle(textarea)
    const lineHeight = parseFloat(style.lineHeight) || 20
    const lines = value.slice(0, completion.start).split('\n')
    const column = [...lines[lines.length - 1]].reduce(
      (at, char) => (char === '\t' ? at + preferences.indentSize - (at % preferences.indentSize) : at + 1),
      0
    )
    const rect = textarea.getBoundingClientRect()
    const left = rect.left + parseFloat(style.paddingLeft) + column * charWidth(style) - textarea.scrollLeft
    const top = rect.top + parseFloat(style.paddingTop) + (lines.length - 1) * lineHeight - textarea.scrollTop
    const below = top + lineHeight,
      height = element.offsetHeight

    element.style.top = `${below + height > window.innerHeight - 8 && top - height > 8 ? top - height : below}px`
    element.style.left = `${Math.max(8, Math.min(left, window.innerWidth - element.offsetWidth - 8))}px`
    element.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  })

  const select = (index: number) => setSelection({ key: completionKey, index })

  const replace = (
    textarea: HTMLTextAreaElement,
    start: number,
    end: number,
    text: string,
    range: [number, number]
  ) => {
    setSuggesting(false)
    textarea.focus()
    textarea.setSelectionRange(start, end)
    // insertText keeps the native undo history; the fallback still produces the same SQL.
    accepting.current = true
    const inserted = document.execCommand('insertText', false, text)
    accepting.current = false

    if (inserted) textarea.setSelectionRange(...range)
    else {
      onChange(value.slice(0, start) + text + value.slice(end))
      requestAnimationFrame(() => textarea.setSelectionRange(...range))
    }
  }

  const accept = (item: CompletionItem) => {
    const textarea = input.current

    if (!textarea || !completion) return

    const { start, end } = completion
    const caret = start + item.insert.length
    replace(textarea, start, end, item.insert, [caret, caret])
  }

  // Formats the selection, or the whole query when nothing is selected.
  const format = (textarea: HTMLTextAreaElement) => {
    const { selectionStart, selectionEnd } = textarea
    const whole = selectionStart === selectionEnd
    const start = whole ? 0 : selectionStart,
      end = whole ? value.length : selectionEnd
    const source = value.slice(start, end),
      formatted = formatSql(source, preferences.indentSize)

    if (formatted === source) return

    const caret = formattedPosition(source, formatted, selectionStart)
    replace(textarea, start, end, formatted, whole ? [caret, caret] : [start, start + formatted.length])
  }

  return (
    <div
      className="query-code"
      style={
        {
          '--editor-font-size': `${preferences.fontSize}px`,
          '--editor-line-height': `${preferences.fontSize + 8}px`,
          '--editor-indent': preferences.indentSize
        } as CSSProperties
      }
    >
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
          ref={input}
          className="sql-input"
          wrap="off"
          aria-label="SQL query"
          aria-autocomplete="list"
          aria-expanded={!!completion}
          aria-controls={completion ? listId : undefined}
          aria-activedescendant={completion ? `${listId}-${active}` : undefined}
          placeholder="SELECT * FROM your_table LIMIT 100;"
          value={value}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => {
            const next = event.target.value,
              position = event.target.selectionStart
            const word = /[\w$.]/.test(next[position - 1] ?? '')
            const typed = next.length - value.length === 1 && word,
              erased = next.length < value.length && suggesting && word

            setSuggesting(preferences.autoComplete && !accepting.current && (typed || erased))
            setCursor(position)
            onChange(next)
          }}
          onBlur={() => setSuggesting(false)}
          onMouseDown={() => setSuggesting(false)}
          onScroll={(event) => {
            if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop

            if (highlight.current) {
              highlight.current.scrollTop = event.currentTarget.scrollTop
              highlight.current.scrollLeft = event.currentTarget.scrollLeft
            }

            if (completion) rerender()
          }}
          onKeyDown={(event) => {
            const plain = !event.metaKey && !event.ctrlKey && !event.altKey

            if (completion && plain) {
              const items = completion.items

              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                select((active + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length)
                return
              }

              if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
                // An exact match leaves Enter free to start a new line.
                if (event.key === 'Enter' && items[active].insert === completion.prefix) {
                  setSuggesting(false)
                  return
                }

                event.preventDefault()
                accept(items[active])
                return
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setSuggesting(false)
                return
              }
            }

            if (event.ctrlKey && !event.metaKey && !event.altKey && event.code === 'Space') {
              event.preventDefault()
              setCursor(event.currentTarget.selectionStart)
              setSuggesting(true)
              return
            }

            if (isFormatQueryShortcut(event)) {
              event.preventDefault()
              format(event.currentTarget)
              return
            }

            if (caretKeys.has(event.key)) setSuggesting(false)

            if (event.key === 'Tab' && !event.shiftKey && plain) {
              event.preventDefault()
              const input = event.currentTarget,
                start = input.selectionStart,
                end = input.selectionEnd
              onChange(value.slice(0, start) + ' '.repeat(preferences.indentSize) + value.slice(end))
              requestAnimationFrame(() => {
                input.selectionStart = input.selectionEnd = start + preferences.indentSize
              })
            }
          }}
        />
      </div>
      {completion &&
        createPortal(
          <SqlCompletionList
            id={listId}
            items={completion.items}
            active={active}
            query={completion.prefix}
            listRef={list}
            onHover={select}
            onPick={(index) => accept(completion.items[index])}
          />,
          document.body
        )}
    </div>
  )
}

function charWidth(style: CSSStyleDeclaration) {
  measure ??= document.createElement('canvas').getContext('2d')

  if (!measure) return 7.2

  measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`

  return measure.measureText('0'.repeat(100)).width / 100
}
