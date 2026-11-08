import type { ReactNode } from 'react'
import { AppShell as Shell, StatusBar } from '@mnml-tools/ui'
import { nativeLinux } from '../../lib/platform'
import type { Connection } from '../../types/connection'
import { AppHeader } from '../organisms/AppHeader'

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
    <Shell framed={nativeLinux} className={variant}>
      <AppHeader status={status} connection={connection} connectionSelector={connectionSelector} />
      {children}
      <StatusBar start={footerLeft} end={footerRight} />
      {dialogs}
    </Shell>
  )
}
