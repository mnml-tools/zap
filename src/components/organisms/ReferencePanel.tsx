import { ArrowLeft, ExternalLink, X } from 'lucide-react'
import type { WorkspaceController } from '../../hooks/useWorkspace'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import { foreignKeyFor, referenceFrom, referenceLabel, referenceTitle, tableLabel } from '../../lib/relations'
import { Button } from '../atoms/Button'
import { ErrorMessage } from '../atoms/ErrorMessage'
import { NullValue } from '../atoms/NullValue'
import { Spinner } from '../atoms/Spinner'
import { ReferenceButton } from '../molecules/ReferenceButton'
import { SidebarResizeHandle } from '../molecules/SidebarResizeHandle'

type Props = Pick<
  WorkspaceController,
  'reference' | 'referenceDepth' | 'followReference' | 'backReference' | 'closeReference' | 'openReferenceInTab'
>

export function ReferencePanel({
  reference: entry,
  referenceDepth,
  followReference,
  backReference,
  closeReference,
  openReferenceInTab
}: Props) {
  const resize = useSidebarResize({
    storageKey: 'zap.referencePanelWidth',
    initial: 320,
    minimum: 240,
    maximum: 640,
    edge: 'left'
  })

  if (!entry) return null

  const { reference, data, error } = entry
  const row = data?.rows[0]
  const target = tableLabel(reference.key.target)

  return (
    <aside
      id="reference-panel"
      className="reference-panel"
      style={{ width: resize.width }}
      aria-label={`Referenced row in ${target}`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeReference()
      }}
    >
      <SidebarResizeHandle {...resize} label="Resize reference panel" controls="reference-panel" />
      <div className="reference-header">
        {referenceDepth > 1 && (
          <Button className="icon-button" title="Back" aria-label="Back" onClick={backReference}>
            <ArrowLeft size={13} aria-hidden="true" />
          </Button>
        )}
        <div className="reference-title">
          <strong>{target}</strong>
          <span>{referenceLabel(reference)}</span>
        </div>
        <Button className="icon-button" title="Close" aria-label="Close" onClick={closeReference}>
          <X size={13} aria-hidden="true" />
        </Button>
      </div>
      <div className="reference-body" aria-busy={!data && !error}>
        {!data && !error && (
          <div className="table-message">
            <Spinner size={15} />
            Loading row…
          </div>
        )}
        {error && <ErrorMessage message={error} />}
        {data && !row && (
          <div className="table-message">
            No row in {target} matches. It may have been deleted, or the relation is not enforced.
          </div>
        )}
        {data && row && (
          <dl className="reference-fields">
            {data.columns.map((column, index) => {
              const key = foreignKeyFor(data, index)
              const next = key && referenceFrom(key, row)
              const value = row[index]

              return (
                <div key={column}>
                  <dt>
                    {column}
                    {data.primaryKeys.includes(index) && <span className="key-label">PK</span>}
                    {key && (
                      <span className="key-label" title={referenceTitle(key)}>
                        FK
                      </span>
                    )}
                  </dt>
                  <dd>
                    <span>{value === null ? <NullValue /> : value}</span>
                    {key && next && (
                      <ReferenceButton title={referenceTitle(key)} onOpen={() => followReference(next)} />
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}
        {data && data.total > 1 && <p className="reference-note">{data.total} rows match. Showing the first.</p>}
      </div>
      <div className="reference-footer">
        <Button onClick={openReferenceInTab} disabled={!data}>
          <ExternalLink size={12} aria-hidden="true" />
          Open in tab
        </Button>
      </div>
    </aside>
  )
}
