import { useState, type ReactNode } from 'react'
import { Settings } from 'lucide-react'
import { GeneralSettings } from './GeneralSettings'
import { Button, StatusDot, TitleBar } from '@mnml-tools/ui'
import { WindowControls } from '@mnml-tools/ui/tauri'
import type { Connection } from '../../types/connection'
import { ConnectionSummary } from '../molecules/ConnectionSummary'
import { nativeLinux, nativeMac } from '../../lib/platform'
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
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <TitleBar
        macInset={nativeMac}
        brand={<BrandMark />}
        center={connectionSelector ?? (connection && <ConnectionSummary connection={connection} />)}
        end={
          <>
            <Button
              className="settings-trigger"
              title="General settings"
              aria-label="General settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={15} />
            </Button>
            <StatusDot />
            {status}
            {connection && <ConnectionEnvironmentBadge environment={connection.environment} />}
            {nativeLinux && <WindowControls />}
          </>
        }
      />
      {settingsOpen && <GeneralSettings onDismiss={() => setSettingsOpen(false)} />}
    </>
  )
}
