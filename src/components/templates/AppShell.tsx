import type { ReactNode } from 'react'
import { nativeLinux } from '../../lib/platform'
import type { Connection } from '../../types/connection'
import { AppHeader } from '../organisms/AppHeader'
import { AppFooter } from '../molecules/AppFooter'

type Props = {
  variant: 'app' | 'workspace'
  status: string
  connection?: Connection
  footerLeft: ReactNode
  footerRight: ReactNode
  children: ReactNode
  dialogs?: ReactNode
}

export function AppShell({ variant, status, connection, footerLeft, footerRight, children, dialogs }: Props) {
  return (
    <div className={nativeLinux ? `${variant} linux-window` : variant}>
      <AppHeader status={status} connection={connection} />
      {children}
      <AppFooter left={footerLeft} right={footerRight} />
      {dialogs}
    </div>
  )
}
