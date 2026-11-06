import type { ReactNode } from 'react'
import { nativeLinux } from '../../lib/platform'
import type { Connection } from '../../types/connection'
import { AppHeader } from '../organisms/AppHeader'
import { AppFooter } from '../molecules/AppFooter'

type Props = {
  variant: 'app' | 'workspace'
  status: string
  connectionSelector?: ReactNode
  connection?: Connection
  footerLeft: ReactNode
  footerRight: ReactNode
  children: ReactNode
  dialogs?: ReactNode
}

export function AppShell({
  variant,
  status,
  connection,
  connectionSelector,
  footerLeft,
  footerRight,
  children,
  dialogs
}: Props) {
  return (
    <div className={nativeLinux ? `${variant} linux-window` : variant}>
      <AppHeader status={status} connection={connection} connectionSelector={connectionSelector} />
      {children}
      <AppFooter left={footerLeft} right={footerRight} />
      {dialogs}
    </div>
  )
}
