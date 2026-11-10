import { highlightSql } from './sqlHighlight.ts'

const changes = new Set([
  'INSERT',
  'UPDATE',
  'DELETE',
  'REPLACE',
  'MERGE',
  'CREATE',
  'ALTER',
  'DROP',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'CALL'
])

export function queryNeedsConfirmation(sql: string) {
  const tokens = highlightSql(sql).filter((token) => token.kind !== 'comment' && token.text.trim())

  return tokens.some(
    (token, index) =>
      token.kind === 'keyword' &&
      changes.has(token.text.toUpperCase()) &&
      !(token.text.toUpperCase() === 'UPDATE' && tokens[index - 1]?.text.toUpperCase() === 'FOR')
  )
}
