import type { Connection } from '../../types/connection'

export function ConnectionEnvironmentBadge({ environment }: { environment: Connection['environment'] }) {
  if (!environment) return null

  return (
    <span
      className="environment-badge"
      data-environment={environment}
      title={environment === 'prod' ? 'Production connection' : 'Local connection'}
      style={{ marginLeft: 10 }}
    >
      {environment === 'prod' ? 'Prod' : 'Local'}
    </span>
  )
}
