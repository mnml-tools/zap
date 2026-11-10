import type { ReactNode } from 'react'

export function SettingsField({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <label className="settings-field">
      <span>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      {children}
    </label>
  )
}
