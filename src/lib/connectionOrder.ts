export function orderConnections<T extends { id: string }>(connections: T[], order: string[]): T[] {
  const ranks = new Map(order.map((id, index) => [id, index]))

  return [...connections].sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity))
}

export function moveConnection<T extends { id: string }>(connections: T[], source: string, target: string): T[] {
  const from = connections.findIndex((connection) => connection.id === source)
  const to = connections.findIndex((connection) => connection.id === target)
  if (from < 0 || to < 0 || from === to) return connections

  const next = [...connections]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)

  return next
}
