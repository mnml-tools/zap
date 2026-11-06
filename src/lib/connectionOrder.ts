export function orderConnections<T extends { title: string; environment?: string | null }>(connections: T[]): T[] {
  const rank = (environment?: string | null) => (environment === 'local' ? 0 : environment === 'prod' ? 2 : 1)

  return [...connections].sort((a, b) => {
    const title = a.title.trim().localeCompare(b.title.trim(), undefined, { sensitivity: 'base', numeric: true })

    return title || rank(a.environment) - rank(b.environment)
  })
}
