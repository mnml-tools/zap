import test from 'node:test'
import assert from 'node:assert/strict'
import { formatSql, formattedPosition } from '../src/lib/sqlFormat.ts'
import { highlightSql } from '../src/lib/sqlHighlight.ts'

const corpus = [
  "select u.id, u.name, count(o.id) as orders, sum(case when o.status = 'paid' then o.total else 0 end) as paid from users u left join orders o on o.user_id = u.id and o.deleted_at is null where u.active = true and u.created_at between '2024-01-01' and '2024-12-31' or u.vip group by u.id, u.name having count(o.id) > 5 order by orders desc limit 50 offset 10;",
  'SELECT * FROM a WHERE id IN (SELECT a_id FROM b WHERE x = 1) AND y IS DISTINCT FROM z; select 1',
  "WITH RECURSIVE recent AS (SELECT * FROM orders WHERE created_at > now() - interval '7 days'), totals AS (SELECT user_id, SUM(total) t FROM recent GROUP BY user_id) SELECT DISTINCT ON (user_id) * FROM totals ORDER BY user_id, t DESC",
  "INSERT INTO users (name, email) VALUES ('a', 'b'), ('c', 'd') ON CONFLICT (email) DO UPDATE SET name = excluded.name RETURNING id",
  'insert ignore into t (a,b) values (1,2) on duplicate key update a = values(a), b = values(b)',
  "UPDATE users u JOIN teams t ON t.id = u.team_id SET u.name = 'x', u.age = u.age + 1 WHERE u.id = 5",
  'DELETE FROM sessions WHERE expires_at < now() RETURNING *',
  'SELECT a, -- the a\n b /* bee */, c FROM t -- tail\nWHERE x = 1',
  'CREATE TABLE t (id serial PRIMARY KEY, name varchar(255) NOT NULL, ref int REFERENCES x(id) ON DELETE SET NULL)',
  'select left(name, 3), t.from, "select", `order` from t cross join lateral (select 1) z for update',
  'SELECT row_number() OVER (PARTITION BY a ORDER BY b) FROM t UNION ALL SELECT 1 FROM u',
  "SELECT $body$SELECT 1; FROM x -- not a comment$body$, E'it\\'s', 'multi\n  line' FROM t",
  'SELECT /* outer /* nested */ still */ a FROM t # mysql comment\nWHERE b = :name AND c = $1 AND d = ? AND e = @v',
  "SELECT a::text, b->>'k', c #> '{a}' FROM t WHERE d IN(1,2)AND e=-1",
  'SELECT ação, 1from, x.select FROM tábua',
  'SELECT CASE WHEN a THEN CASE b WHEN 1 THEN 2 END ELSE 3 END FROM t',
  'SELECT (SELECT max(x) FROM y) AS m, COALESCE((SELECT 1), 0) FROM ((SELECT 1)) q',
  'select 1 -- trailing',
  '-- only a comment',
  'SELECT a FROM t WHERE (a = 1 OR b = 2) AND NOT EXISTS (SELECT 1 FROM u WHERE u.a = t.a)',
  'SELECT * FROM t LIMIT 10, 20',
  'SELECT x FROM t ORDER BY 1 FETCH FIRST 5 ROWS ONLY',
  'SET search_path = public; EXPLAIN ANALYZE SELECT 1',
  'SELECT a FROM t WHERE a = (SELECT 1',
  'SELECT a) FROM t',
  "SELECT 'unfinished",
  'SELECT /* unfinished',
  '',
  '   \n  ',
  'SELECT\n  a\nFROM\n  t\n\n\n',
  'select a,b,c from t;;select 2'
]

// Splits code into non-whitespace pieces, each flagged with whether whitespace preceded it.
function pieces(sql) {
  const result = []
  let space = false

  for (const token of highlightSql(sql)) {
    if (['text', 'keyword', 'function'].includes(token.kind)) {
      for (const [part] of token.text.matchAll(/\s+|[\p{L}_][\p{L}\p{N}_$]*|[\s\S]/gu)) {
        if (/^\s/.test(part)) space = true
        else {
          result.push({ text: part, space, kind: token.kind })
          space = false
        }
      }
    } else {
      result.push({ text: token.text, space, kind: token.kind })
      space = false
    }
  }

  return result
}

test('formatting changes only whitespace between tokens and keyword casing', () => {
  for (const sql of corpus) {
    const formatted = formatSql(sql)
    const before = pieces(sql),
      after = pieces(formatted)

    assert.equal(after.length, before.length, sql)
    before.forEach((piece, index) => {
      const text = after[index].text

      if (text !== piece.text)
        assert.ok(
          ['keyword', 'text'].includes(piece.kind) &&
            /^[\p{L}_]/u.test(piece.text) &&
            text === piece.text.toUpperCase(),
          `${sql}\nchanged ${piece.text} to ${text}`
        )

      if (piece.space) assert.ok(after[index].space, `${sql}\nlost the space before ${piece.text}`)
    })
  }
})

test('line comments always end their line', () => {
  for (const sql of corpus) {
    const formatted = formatSql(sql)
    const tokens = highlightSql(formatted)

    tokens.forEach((token, index) => {
      if (token.kind === 'comment' && !token.text.trimEnd().endsWith('*/') && index < tokens.length - 1)
        assert.match(tokens[index + 1].text, /^[^\S\n]*\n/, formatted)
    })
  }
})

test('uppercases keywords but keeps keywords used as names as written', () => {
  assert.equal(
    formatSql(
      "select date, d.text, first.id, cast(d.at as date) from date d join orders as first on first.id = d.id where d.at > now() - interval '1 day' order by d.date nulls last"
    ),
    `SELECT
  date,
  d.text,
  first.id,
  CAST(d.at AS date)
FROM
  date d
  JOIN orders AS first ON first.id = d.id
WHERE
  d.at > now() - INTERVAL '1 day'
ORDER BY
  d.date NULLS LAST`
  )
  assert.equal(
    formatSql("select cast(x as date), count(*) from t -- select from\nwhere a = 'select'"),
    "SELECT\n  CAST(x AS DATE),\n  count(*)\nFROM\n  t -- select from\nWHERE\n  a = 'select'"
  )
  assert.equal(
    formatSql('create table if not exists t (id serial primary key, name text not null)'),
    'CREATE TABLE IF NOT EXISTS t (\n  id SERIAL PRIMARY KEY,\n  name TEXT NOT NULL\n)'
  )
})

test('formatting is idempotent', () => {
  for (const sql of corpus) assert.equal(formatSql(formatSql(sql)), formatSql(sql), sql)
})

test('places clauses on their own lines with indented items', () => {
  assert.equal(
    formatSql(
      "select u.id, count(o.id) as orders from users u left join orders o on o.user_id = u.id and o.paid where u.active and u.created_at between '2024-01-01' and '2024-12-31' group by u.id order by orders desc limit 50 offset 10;"
    ),
    `SELECT
  u.id,
  count(o.id) AS orders
FROM
  users u
  LEFT JOIN orders o ON o.user_id = u.id
    AND o.paid
WHERE
  u.active
  AND u.created_at BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY
  u.id
ORDER BY
  orders DESC
LIMIT 50
OFFSET 10;`
  )
})

test('indents subqueries, common table expressions and CASE', () => {
  assert.equal(
    formatSql(
      'WITH totals AS (SELECT user_id, SUM(total) t FROM orders GROUP BY user_id) SELECT DISTINCT ON (user_id) CASE WHEN t > 10 THEN 1 ELSE 0 END AS big FROM totals WHERE user_id IN (SELECT id FROM users)'
    ),
    `WITH
  totals AS (
    SELECT
      user_id,
      SUM(total) t
    FROM
      orders
    GROUP BY
      user_id
  )
SELECT DISTINCT ON (user_id)
  CASE
    WHEN t > 10 THEN 1
    ELSE 0
  END AS big
FROM
  totals
WHERE
  user_id IN (
    SELECT
      id
    FROM
      users
  )`
  )
})

test('formats writes and keeps clause words together', () => {
  assert.equal(
    formatSql(
      "INSERT INTO users (name, email) VALUES ('a', 'b'), ('c', 'd') ON CONFLICT (email) DO UPDATE SET name = excluded.name, seen = now() RETURNING id"
    ),
    `INSERT INTO
  users (name, email)
VALUES
  ('a', 'b'),
  ('c', 'd')
ON CONFLICT (email) DO UPDATE SET
  name = excluded.name,
  seen = now()
RETURNING
  id`
  )
  assert.equal(
    formatSql('insert into t (a) values (1) on duplicate key update a = values(a), b = 2'),
    `INSERT INTO
  t (a)
VALUES
  (1)
ON DUPLICATE KEY UPDATE
  a = VALUES(a),
  b = 2`
  )
  assert.equal(
    formatSql("UPDATE t SET a = 1, b = 'x' WHERE id = 5"),
    "UPDATE\n  t\nSET\n  a = 1,\n  b = 'x'\nWHERE\n  id = 5"
  )
  assert.equal(formatSql('DELETE FROM t WHERE id = 5'), 'DELETE FROM\n  t\nWHERE\n  id = 5')
  assert.equal(
    formatSql('CREATE TABLE t (id int PRIMARY KEY, name varchar(20) NOT NULL)'),
    'CREATE TABLE t (\n  id INT PRIMARY KEY,\n  name VARCHAR(20) NOT NULL\n)'
  )
})

test('leaves keyword-like names, functions and parenthesized expressions inline', () => {
  assert.equal(
    formatSql('select left(name, 3), t.from, "select" from t where a is distinct from b and (c = 1 or d = 2)'),
    `SELECT
  LEFT(name, 3),
  t.from,
  "select"
FROM
  t
WHERE
  a IS DISTINCT FROM b
  AND (c = 1 OR d = 2)`
  )
  assert.equal(
    formatSql('SELECT row_number() OVER (PARTITION BY a ORDER BY b) FROM t'),
    'SELECT\n  row_number() OVER (PARTITION BY a ORDER BY b)\nFROM\n  t'
  )
})

test('separates statements and set operations', () => {
  assert.equal(
    formatSql('select 1 union all select 2; select 3'),
    'SELECT\n  1\nUNION ALL\nSELECT\n  2;\n\nSELECT\n  3'
  )
})

test('keeps comments next to the code they describe', () => {
  assert.equal(
    formatSql('SELECT a, -- the a\n  -- about b\n  b FROM t -- tail\nWHERE x = 1'),
    `SELECT
  a, -- the a
  -- about b
  b
FROM
  t -- tail
WHERE
  x = 1`
  )
})

test('uses the configured indent size', () => {
  assert.equal(formatSql('SELECT a FROM t', 4), 'SELECT\n    a\nFROM\n    t')
})

test('maps the cursor to the same code position', () => {
  const source = 'select a, b from t'
  const formatted = formatSql(source)
  const before = (position) => formatted.slice(0, formattedPosition(source, formatted, position))

  assert.equal(before(source.indexOf('b')), 'SELECT\n  a,\n  ')
  assert.equal(before(source.indexOf(',') + 1), 'SELECT\n  a,')
  assert.equal(before(source.indexOf('a') + 1), 'SELECT\n  a')
  assert.equal(before(0), '')
  assert.equal(before(source.length), formatted)
  assert.equal(formattedPosition('  x', 'x', 2), 0)
})
