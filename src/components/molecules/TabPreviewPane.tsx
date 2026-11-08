import type { ReactNode } from 'react'
import { highlightSql } from '../../lib/sqlHighlight'
import { loadedAgo, previewSql } from '../../lib/tabPreview'
import type { TabPreview } from '../../lib/tabPreview'
import { Spinner } from '@mnml-tools/ui'
import { PreviewGrid } from './PreviewGrid'

type Props = { title: string; icon: ReactNode; preview: TabPreview }

const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`

export function TabPreviewPane({ title, icon, preview }: Props) {
  const query = preview.kind === 'query' ? preview.query : undefined
  const sql = query ? previewSql(query.sql) : undefined
  const busy = preview.kind === 'table' ? preview.loading : !!query?.running

  return (
    <section className="tab-preview" aria-label={`Preview of ${title}`}>
      <div className="tab-preview-header">
        {icon}
        <strong>{title}</strong>
        <span className="tab-preview-subtitle">{preview.subtitle}</span>
        {busy && (
          <span className="tab-preview-busy">
            <Spinner size={11} />
            {preview.kind === 'table' ? 'Loading' : 'Running'}
          </span>
        )}
      </div>

      {preview.kind === 'table' &&
        (preview.grid ? (
          <>
            <PreviewGrid grid={preview.grid} />
            <p className="tab-preview-note">
              {[
                plural(preview.grid.total, 'row'),
                preview.grid.hiddenColumns > 0 && `${plural(preview.grid.hiddenColumns, 'more column')}`,
                preview.pending > 0 && plural(preview.pending, 'pending change'),
                `loaded ${loadedAgo(preview.grid.loadedAt, Date.now())}`
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </>
        ) : (
          <p className="tab-preview-empty">
            {preview.loading ? (
              <>
                <Spinner size={13} />
                Loading rows…
              </>
            ) : (
              'No rows loaded yet'
            )}
          </p>
        ))}

      {preview.kind === 'query' && (
        <>
          {sql?.text.trim() ? (
            <pre className="tab-preview-sql">
              {highlightSql(sql.text).map((token, index) => (
                <span key={index} className={`sql-${token.kind}`}>
                  {token.text}
                </span>
              ))}
              {sql.more && '\n…'}
            </pre>
          ) : (
            <p className="tab-preview-note">Empty query</p>
          )}
          {query?.running ? (
            <p className="tab-preview-empty">
              <Spinner size={13} />
              Running query…
            </p>
          ) : query?.error ? (
            <p className="tab-preview-error">{query.error}</p>
          ) : query?.result ? (
            <>
              {query.result.columns.length > 0 && <PreviewGrid grid={query.result} />}
              <p className="tab-preview-note">
                {[
                  query.result.columns.length
                    ? plural(query.result.total, 'row')
                    : `${plural(query.result.rowsAffected, 'row')} affected`,
                  query.result.sets > 1 && plural(query.result.sets, 'result set'),
                  `${query.result.durationMs.toLocaleString()} ms`
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </>
          ) : (
            <p className="tab-preview-note">Not run yet</p>
          )}
        </>
      )}
    </section>
  )
}
