import type { ReactNode } from 'react'
import type { Connection } from '../../types/connection'
import { ConnectionSummary } from '../molecules/ConnectionSummary'
import { nativeLinux, nativeMac } from '../../lib/platform'
import { BrandMark } from '../molecules/BrandMark'
import { ThemeToggle } from '../molecules/ThemeToggle'
import { ConnectionEnvironmentBadge } from '../atoms/ConnectionEnvironmentBadge'
import { StatusDot } from '../atoms/StatusDot'
import { WindowControls } from '../molecules/WindowControls'

export function AppHeader({
  status,
  connection,
  connectionSelector
}: {
  status: string
  connection?: Connection
  connectionSelector?: ReactNode
}) {
  return (
    <header data-tauri-drag-region className={nativeMac ? 'native-titlebar' : undefined}>
      <BrandMark />
      {connectionSelector ?? (connection && <ConnectionSummary connection={connection} />)}
      <div className="header-right">
        <ThemeToggle />
        <StatusDot />
        {status}
        {connection && <ConnectionEnvironmentBadge environment={connection.environment} />}
        {nativeLinux && <WindowControls />}
      </div>
    </header>
  )
}
