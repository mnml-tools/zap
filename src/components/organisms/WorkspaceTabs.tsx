import { useCallback, useState } from 'react'
import { Table2, FileCode2, Zap } from 'lucide-react'
import type { WorkspaceController } from '../../hooks/useWorkspace'
import { tableKey, countChanges } from '../../lib/tableState'
import { ActionContextMenu } from '../molecules/ActionContextMenu'
import { WorkspaceTab } from '../molecules/WorkspaceTab'

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
>

export function WorkspaceTabs(props: Props) {
  const [menu, setMenu] = useState<{ key: string; title: string; x: number; y: number }>()
  const dismissMenu = useCallback(() => setMenu(undefined), [])
  const disabled = props.saving || props.structureSaving
  const order = [...props.tabs.map(tableKey), ...props.queryTabs.map((query) => `query:${query.id}`)]
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
          icon={<Table2 size={14} />}
          active={props.active === tableKey(table)}
          dirty={countChanges(props.pending[tableKey(table)]) > 0 || props.structureDirty(tableKey(table))}
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
