import { useState } from 'react'
import { useWorkspace } from '../hooks/useWorkspace'
import type { WorkspaceOptions } from '../hooks/useWorkspace'
import { countChanges } from '../lib/tableState'
import { AppShell } from '../components/templates/AppShell'
import { ErrorMessage } from '../components/atoms/ErrorMessage'
import { ErrorDialog } from '../components/molecules/ErrorDialog'
import { ConfirmDialog } from '../components/molecules/ConfirmDialog'
import { WorkspaceEmptyState } from '../components/molecules/WorkspaceEmptyState'
import { WorkspaceSidebar } from '../components/organisms/WorkspaceSidebar'
import { WorkspaceTabs } from '../components/organisms/WorkspaceTabs'
import { TableView } from '../components/organisms/TableView'
import { ExportTablesDialog } from '../components/organisms/ExportTablesDialog'
import { QueryEditor } from '../components/organisms/QueryEditor'

export function WorkspacePage(options: WorkspaceOptions) {
  const model = useWorkspace(options)
  const [choosingExport, setChoosingExport] = useState(false)

  return (
    <AppShell
      variant="workspace"
      status="Connected"
      connection={options.connection}
      footerLeft={`ZAP / ${options.connection?.database || 'DATABASE'}`}
      footerRight={
        <>
          {Object.values(model.pending).reduce((count, draft) => count + countChanges(draft), 0)} pending changes
          <span className="footer-dot">·</span>
          {model.anyQueryDirty ? 'Unsaved query changes' : 'Double-click a cell to edit'}
        </>
      }
      dialogs={
        model.tableActionError ? (
          <ErrorDialog
            title="Table action failed"
            message={model.tableActionError}
            onDismiss={model.dismissTableActionError}
          />
        ) : choosingExport ? (
          <ExportTablesDialog
            tables={model.tables}
            onCancel={() => setChoosingExport(false)}
            onExport={(tables, includeData) => {
              setChoosingExport(false)
              model.exportTables(tables, includeData)
            }}
          />
        ) : (
          model.confirm && (
            <ConfirmDialog
              message={model.confirm.message}
              onCancel={model.cancelConfirmation}
              onConfirm={model.confirmAction}
            />
          )
        )
      }
    >
      <div className="workspace-body">
        <WorkspaceSidebar {...model} onChooseExportTables={() => setChoosingExport(true)} />
        <section className="data-area">
          <WorkspaceTabs {...model} />
          {model.table ? <TableView {...model} /> : !model.currentQuery && <WorkspaceEmptyState error={model.error} />}
          {model.currentQuery && model.error && <ErrorMessage message={model.error} />}
          {model.queryTabs.map((query) => (
            <div key={query.id} className={model.active === `query:${query.id}` ? 'query-pane' : 'query-pane hidden'}>
              <QueryEditor
                connectionId={options.id}
                query={query}
                request={options.request || model.request}
                onSaved={model.savedQuery}
                onDirty={model.dirtyQuery}
                onBusy={model.busyQuery}
                onDelete={() => model.deleteQuery(query)}
                onExecuted={model.refreshTables}
              />
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  )
}
