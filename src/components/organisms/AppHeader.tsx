import type { ReactNode } from 'react'
import { StatusDot, ThemeToggle, TitleBar } from '@mnml-tools/ui'
import { WindowControls } from '@mnml-tools/ui/tauri'
import type { Connection } from '../../types/connection'
import { ConnectionSummary } from '../molecules/ConnectionSummary'
import { nativeLinux, nativeMac } from '../../lib/platform'
import { theme } from '../../services/theme'
import { BrandMark } from '../molecules/BrandMark'
import { ConnectionEnvironmentBadge } from '../atoms/ConnectionEnvironmentBadge'

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
    <TitleBar
      macInset={nativeMac}
      brand={<BrandMark />}
      center={connectionSelector ?? (connection && <ConnectionSummary connection={connection} />)}
      end={
        <>
          <ThemeToggle theme={theme} />
          <StatusDot />
          {status}
          {connection && <ConnectionEnvironmentBadge environment={connection.environment} />}
          {nativeLinux && <WindowControls />}
        </>
      }
    />
  )
}
