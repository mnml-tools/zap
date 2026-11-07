// Most recently used first. Tabs that were never active keep their tab bar order at the end.
export function recentTabs(open: string[], history: string[]) {
  const recent = history.filter((key) => open.includes(key))

  return [...recent, ...open.filter((key) => !recent.includes(key))]
}

export function touchTab(history: string[], key: string) {
  return key ? [key, ...history.filter((item) => item !== key)] : history
}

export function stepTab(index: number, length: number, backwards: boolean) {
  return (index + (backwards ? length - 1 : 1)) % length
}

export function isTabSwitch(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>) {
  return event.key === 'Tab' && event.ctrlKey && !event.metaKey && !event.altKey
}
