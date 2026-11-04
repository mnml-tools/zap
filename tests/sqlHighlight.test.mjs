import test from 'node:test'
import assert from 'node:assert/strict'
import { highlightSql } from '../src/lib/sqlHighlight.ts'
test('highlights SQL tokens without modifying code', () => {
  const sql = `-- latest users\nSELECT COUNT(*), "user name", 1.25e-2 FROM users WHERE name = 'O''Reilly' AND id = $1;`
  const tokens = highlightSql(sql)
  assert.equal(tokens.map((t) => t.text).join(''), sql)
  for (const [kind, text] of [
    ['keyword', 'SELECT'],
    ['function', 'COUNT'],
    ['identifier', '"user name"'],
    ['number', '1.25e-2'],
    ['string', "'O''Reilly'"],
    ['parameter', '$1']
  ])
    assert.ok(
      tokens.some((t) => t.kind === kind && t.text.includes(text)),
      `${kind}: ${text}`
    )
})
test('keeps keywords inside nested comments and dollar strings uncolored', () => {
  const sql = '/* SELECT /* inner */ FROM */ SELECT $body$SELECT 1; -- text$body$;'
  const tokens = highlightSql(sql)
  assert.equal(tokens.map((t) => t.text).join(''), sql)
  assert.equal(tokens[0].kind, 'comment')
  assert.ok(tokens.some((t) => t.kind === 'string' && t.text === '$body$SELECT 1; -- text$body$'))
})
test('preserves incomplete code, HTML-like text, and trailing blank lines', () => {
  for (const sql of [
    '',
    "SELECT '<script> & value'\n\n",
    'SELECT /* unfinished',
    "SELECT 'unfinished",
    'SELECT $tag$unfinished',
    "SELECT E'escaped\\\'value'",
    'SELECT value::text, :named, @named, ? FROM `table`'
  ]) {
    assert.equal(
      highlightSql(sql)
        .map((t) => t.text)
        .join(''),
      sql
    )
  }
  assert.ok(highlightSql('SELECT value::text').some((t) => t.kind === 'operator' && t.text === '::'))
})
