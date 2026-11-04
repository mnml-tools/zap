import type { Connection } from '../../types/connection'
import { ConnectionSummary } from '../molecules/ConnectionSummary'
import { nativeLinux, nativeMac } from '../../lib/platform'
import { BrandMark } from '../molecules/BrandMark'
import { ThemeToggle } from '../molecules/ThemeToggle'
import { StatusDot } from '../atoms/StatusDot'
import { WindowControls } from '../molecules/WindowControls'

export function AppHeader({ status, connection }: { status: string; connection?: Connection }) {
  return (
    <header data-tauri-drag-region className={nativeMac ? 'native-titlebar' : undefined}>
      <BrandMark />
      {connection && <ConnectionSummary connection={connection} />}
      <div className="header-right">
        <ThemeToggle />
        <StatusDot />
        {status}
        {nativeLinux && <WindowControls />}
      </div>
    </header>
  )
}
