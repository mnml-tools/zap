export type SqlToken = {
  kind: 'text' | 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'identifier' | 'parameter' | 'operator'
  text: string
}

const keywords = new Set(
  `SELECT FROM WHERE AS AND OR NOT NULL IS IN LIKE ILIKE BETWEEN EXISTS DISTINCT ALL ANY SOME UNION INTERSECT EXCEPT JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL ON USING WITH RECURSIVE GROUP BY HAVING ORDER ASC DESC NULLS FIRST LAST LIMIT OFFSET FETCH NEXT ROW ROWS ONLY FOR UPDATE INSERT INTO VALUES DEFAULT DELETE RETURNING SET CONFLICT DO NOTHING REPLACE IGNORE CREATE ALTER DROP TRUNCATE TABLE VIEW MATERIALIZED INDEX UNIQUE PRIMARY KEY FOREIGN REFERENCES CONSTRAINT CHECK ADD COLUMN RENAME TO IF CASCADE RESTRICT DATABASE SCHEMA TEMP TEMPORARY BEGIN START TRANSACTION COMMIT ROLLBACK SAVEPOINT RELEASE EXPLAIN ANALYZE VACUUM PRAGMA SHOW DESCRIBE USE GRANT REVOKE CASE WHEN THEN ELSE END TRUE FALSE UNKNOWN CAST COLLATE OVER PARTITION WINDOW FILTER RANGE PRECEDING FOLLOWING UNBOUNDED CURRENT LATERAL MERGE MATCHED CALL PROCEDURE FUNCTION RETURNS LANGUAGE INT INTEGER SMALLINT BIGINT DECIMAL NUMERIC REAL DOUBLE PRECISION FLOAT BOOLEAN BOOL TEXT VARCHAR CHAR CHARACTER DATE TIME TIMESTAMP INTERVAL UUID JSON JSONB BYTEA BLOB ARRAY SERIAL BIGSERIAL ENUM UNSIGNED AUTO_INCREMENT GENERATED ALWAYS IDENTITY STORED VIRTUAL`.split(
    /\s+/
  )
)

/** Lossless display tokens: the original SQL is never transformed or interpreted. */

export function highlightSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []

  const push = (kind: SqlToken['kind'], text: string) => {
    const last = tokens.at(-1)

    if (last?.kind === kind) last.text += text
    else tokens.push({ kind, text })
  }

  let i = 0

  while (i < sql.length) {
    const start = i,
      tail = sql.slice(i),
      c = sql[i]
    const whitespace = /^\s+/.exec(tail)

    if (whitespace) {
      push('text', whitespace[0])
      i += whitespace[0].length
      continue
    }

    if (tail.startsWith('--') || (c === '#' && !['>', '-'].includes(sql[i + 1]))) {
      const end = sql.indexOf('\n', i)
      i = end < 0 ? sql.length : end
      push('comment', sql.slice(start, i))
      continue
    }

    if (tail.startsWith('/*')) {
      i += 2
      let depth = 1

      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) {
          depth++
          i += 2
        } else if (sql.startsWith('*/', i)) {
          depth--
          i += 2
        } else i++
      }

      push('comment', sql.slice(start, i))
      continue
    }

    const dollar = /^\$(?:[A-Za-z_]\w*)?\$/.exec(tail)

    if (dollar) {
      const end = sql.indexOf(dollar[0], i + dollar[0].length)
      i = end < 0 ? sql.length : end + dollar[0].length
      push('string', sql.slice(start, i))
      continue
    }

    const escapeString = (c === 'E' || c === 'e') && sql[i + 1] === "'"

    if (c === "'" || c === '"' || c === '`' || c === '[' || escapeString) {
      const quote = escapeString ? "'" : c,
        endQuote = quote === '[' ? ']' : quote
      i += escapeString ? 2 : 1

      while (i < sql.length) {
        if (sql[i] === '\\' && quote === "'") {
          i = Math.min(i + 2, sql.length)
          continue
        }

        if (sql[i] === endQuote) {
          i++

          if (sql[i] === endQuote) {
            i++
            continue
          }

          break
        }

        i++
      }

      push(quote === "'" ? 'string' : 'identifier', sql.slice(start, i))
      continue
    }

    const number = /^(?:0[xX][\da-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(tail)

    if (number) {
      push('number', number[0])
      i += number[0].length
      continue
    }

    const parameter = /^(?:\$\d+|:[A-Za-z_]\w*|@[A-Za-z_]\w*|\?(?:\d+)?)/.exec(tail)

    if (parameter) {
      push('parameter', parameter[0])
      i += parameter[0].length
      continue
    }

    const word = /^[A-Za-z_][\w$]*/.exec(tail)

    if (word) {
      i += word[0].length
      push(keywords.has(word[0].toUpperCase()) ? 'keyword' : /^\s*\(/.test(sql.slice(i)) ? 'function' : 'text', word[0])
      continue
    }

    const operator = /^(?:::|->>|->|#>>|#>|#-|>=|<=|<>|!=|\|\||&&|[-+*/%=<>!~^|&])/.exec(tail)

    if (operator) {
      push('operator', operator[0])
      i += operator[0].length
      continue
    }

    push('text', c)
    i++
  }

  return tokens
}
