import { useCallback, useState } from 'react'
import { FileCode2, Zap } from 'lucide-react'
import type { WorkspaceController } from '../../hooks/useWorkspace'
import { tableKey, countChanges, isView } from '../../lib/tableState'
import type { TabPreview } from '../../lib/tabPreview'
import { TableIcon } from '../atoms/TableIcon'
import { ActionContextMenu } from '../molecules/ActionContextMenu'
import { WorkspaceTab } from '../molecules/WorkspaceTab'
import { TabSwitcher } from '../molecules/TabSwitcher'

type Props = Pick<
  WorkspaceController,
  | 'tabs'
  | 'active'
  | 'saving'
  | 'structureSaving'
  | 'structureDirty'
  | 'pending'
  | 'queryTabs'
  | 'queryDirty'
  | 'queryBusy'
  | 'selectTable'
  | 'closeTab'
  | 'closeTabs'
  | 'selectQuery'
  | 'closeQuery'
  | 'loading'
  | 'tablePreviews'
  | 'queryPreviews'
>

export function WorkspaceTabs(props: Props) {
  const [menu, setMenu] = useState<{ key: string; title: string; x: number; y: number }>()
  const dismissMenu = useCallback(() => setMenu(undefined), [])
  const disabled = props.saving || props.structureSaving
  const tableDirty = (key: string) => countChanges(props.pending[key]) > 0 || props.structureDirty(key)
  const switchable = [
    ...props.tabs.map((table) => ({
      key: tableKey(table),
      title: table.name,
      icon: <TableIcon table={table} size={14} />,
      dirty: tableDirty(tableKey(table)),
      select: () => props.selectTable(table),
      preview: (): TabPreview => ({
        kind: 'table',
        subtitle: table.schema || (isView(table) ? 'View' : 'Table'),
        loading: props.loading && props.active === tableKey(table),
        grid: props.tablePreviews[tableKey(table)],
        pending: countChanges(props.pending[tableKey(table)])
      })
    })),
    ...props.queryTabs.map((query) => ({
      key: `query:${query.id}`,
      title: query.title,
      icon: query.quick ? <Zap size={14} className="quick-query-icon" /> : <FileCode2 size={14} />,
      dirty: !!props.queryDirty[query.id],
      select: () => props.selectQuery(query),
      preview: (): TabPreview => ({
        kind: 'query',
        subtitle: query.quick ? 'Quick query' : query.isNew ? 'New query' : 'Saved query',
        query: props.queryPreviews.read(`query:${query.id}`)
      })
    }))
  ]
  const order = switchable.map((tab) => tab.key)
  const index = menu ? order.indexOf(menu.key) : -1

  const action = (label: string, keys: string[]) => ({
    label,
    disabled: disabled || !keys.length || keys.some((key) => key.startsWith('query:') && props.queryBusy[key.slice(6)]),
    run: () => {
      dismissMenu()
      props.closeTabs(keys)
    }
  })

  return (
    <div className="tabs">
      {props.tabs.map((table) => (
        <WorkspaceTab
          key={tableKey(table)}
          title={table.name}
          icon={<TableIcon table={table} size={14} />}
          active={props.active === tableKey(table)}
          dirty={tableDirty(tableKey(table))}
          disabled={props.saving || props.structureSaving}
          closeLabel={`Close ${table.name}`}
          onSelect={() => props.selectTable(table)}
          onClose={() => props.closeTab(table)}
          onContextMenu={(event) => {
            event.preventDefault()
            if (disabled) return

            const rect = event.currentTarget.getBoundingClientRect()
            setMenu({
              key: tableKey(table),
              title: table.name,
              x: event.clientX || rect.left,
              y: event.clientY || rect.bottom
            })
          }}
        />
      ))}
      {props.queryTabs.map((query) => (
        <WorkspaceTab
          key={query.id}
          title={query.title}
          icon={query.quick ? <Zap size={14} className="quick-query-icon" /> : <FileCode2 size={14} />}
          active={props.active === `query:${query.id}`}
          dirty={!!props.queryDirty[query.id]}
          disabled={props.saving || props.structureSaving}
          closeDisabled={!!props.queryBusy[query.id]}
          closeLabel={`Close query ${query.title}`}
          onSelect={() => props.selectQuery(query)}
          onClose={() => props.closeQuery(query)}
        />
      ))}
      <TabSwitcher
        tabs={switchable}
        active={props.active}
        disabled={disabled}
        subscribe={props.queryPreviews.subscribe}
      />
      {menu && index >= 0 && (
        <ActionContextMenu
          key={menu.key}
          title={menu.title}
          x={menu.x}
          y={menu.y}
          onDismiss={dismissMenu}
          actions={[
            action('Close tab', [menu.key]),
            action('Close all tabs to the left', order.slice(0, index)),
            action('Close all tabs to the right', order.slice(index + 1)),
            action(
              'Close all tabs except this',
              order.filter((key) => key !== menu.key)
            ),
            action('Close all tabs', order)
          ]}
        />
      )}
    </div>
  )
}
