import { ArrowLeft, ExternalLink, X } from 'lucide-react'
import type { WorkspaceController } from '../../hooks/useWorkspace'
import { foreignKeyFor, referenceFrom, referenceLabel, referenceTitle, tableLabel } from '../../lib/relations'
import { IconButton, Message, ResizeHandle, Sidebar, Spinner, useResize } from '@mnml-tools/ui'
import { NullValue } from '../atoms/NullValue'
import { ReferenceButton } from '../molecules/ReferenceButton'

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
  const resize = useResize({
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
    <Sidebar
      id="reference-panel"
      className="reference-panel"
      style={{ width: resize.width }}
      aria-label={`Referenced row in ${target}`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeReference()
      }}
    >
      <ResizeHandle {...resize} label="Resize reference panel" controls="reference-panel" />
      <div className="reference-header">
        {referenceDepth > 1 && (
          <IconButton title="Back" aria-label="Back" onClick={backReference}>
            <ArrowLeft size={13} aria-hidden="true" />
          </IconButton>
        )}
        <div className="reference-heading">
          <strong>Preview</strong>
          <span className="reference-table-badge">{target}</span>
        </div>
        <IconButton title="Close" aria-label="Close" onClick={closeReference}>
          <X size={13} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="reference-summary">
        <span className="reference-summary-label">Record</span>
        <div className="reference-record">
          <span>{referenceLabel(reference)}</span>
          <IconButton title="Open in tab" aria-label="Open in tab" onClick={openReferenceInTab} disabled={!data}>
            <ExternalLink size={12} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      <div className="reference-body" aria-busy={!data && !error}>
        {!data && !error && (
          <div className="table-message">
            <Spinner size={15} />
            Loading row…
          </div>
        )}
        {error && <Message tone="error">{error}</Message>}
        {data && !row && (
          <div className="table-message">
            No row in {target} matches. It may have been deleted, or the relation is not enforced.
          </div>
        )}
        {data && row && (
          <table className="reference-fields" aria-label={`Preview of ${target}`}>
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.columns.map((column, index) => {
                const key = foreignKeyFor(data, index)
                const next = key && referenceFrom(key, row)
                const value = row[index]

                return (
                  <tr key={column}>
                    <th scope="row">
                      {column}
                      {data.primaryKeys.includes(index) && <span className="key-label">PK</span>}
                      {key && (
                        <span className="key-label" title={referenceTitle(key)}>
                          FK
                        </span>
                      )}
                    </th>
                    <td>
                      <div className="reference-value">
                        <span>{value === null ? <NullValue /> : value}</span>
                        {key && next && (
                          <ReferenceButton title={referenceTitle(key)} onOpen={() => followReference(next)} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {data && data.total > 1 && <p className="reference-note">{data.total} rows match. Showing the first.</p>}
      </div>
    </Sidebar>
  )
}
