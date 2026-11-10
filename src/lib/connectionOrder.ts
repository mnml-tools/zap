export function orderConnections<T extends { title: string; environment?: string | null }>(
  connections: T[],
  order: 'name' | 'environment' = 'name'
): T[] {
  const rank = (environment?: string | null) => (environment === 'local' ? 0 : environment === 'prod' ? 2 : 1)

  return [...connections].sort((a, b) => {
    const title = a.title.trim().localeCompare(b.title.trim(), undefined, { sensitivity: 'base', numeric: true })

    if (order === 'environment') return rank(a.environment) - rank(b.environment) || title

    return title || rank(a.environment) - rank(b.environment)
  })
}
