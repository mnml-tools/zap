export type SqlToken = {
  kind: 'keyword' | 'word' | 'identifier' | 'punct' | 'operator' | 'value' | 'group'
  text: string
  start: number
  end: number
}

/** What the cursor position accepts: table names, column operands, or only the listed keywords. */

export type ClauseContext = { kind: 'table' | 'column' | 'keyword' | 'none'; keywords: string[] }

type Marker = { name: string; end: number }

// Clause order per statement; a clause is offered only after the current one and before the next one present.
const flows: Record<string, string[]> = {
  SELECT: ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET'],
  UPDATE: ['UPDATE', 'SET', 'FROM', 'WHERE', 'RETURNING'],
  DELETE: ['DELETE', 'FROM', 'USING', 'WHERE', 'RETURNING'],
  INSERT: ['INSERT', 'INTO', 'VALUES', 'ON CONFLICT', 'RETURNING']
}

const starters: Record<string, string> = {
  SELECT: 'SELECT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  INSERT: 'INSERT',
  UNION: 'SELECT',
  INTERSECT: 'SELECT',
  EXCEPT: 'SELECT'
}

const markerNames = new Set([
  'SELECT',
  'FROM',
  'JOIN',
  'ON',
  'USING',
  'WHERE',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'SET',
  'RETURNING',
  'VALUES',
  'INTO',
  'UPDATE',
  'DELETE',
  'INSERT',
  'WITH',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'TABLE',
  'TRUNCATE',
  'DESCRIBE',
  'CREATE',
  'ALTER',
  'DROP',
  'EXPLAIN'
])

const tableMarkers = new Set(['FROM', 'JOIN', 'UPDATE', 'INTO', 'TABLE', 'TRUNCATE', 'DESCRIBE'])

export const referenceModifiers = new Set(['IF', 'NOT', 'EXISTS', 'ONLY', 'LATERAL'])

const subqueryOwners = new Set(['FROM', 'JOIN', 'IN', 'EXISTS', 'AS', 'UNION', 'INTERSECT', 'EXCEPT'])

const operandKeywords = new Set([
  'AND',
  'OR',
  'NOT',
  'LIKE',
  'ILIKE',
  'BETWEEN',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'DISTINCT',
  'ALL',
  'ANY',
  'SOME'
])

const comparisonKeywords = new Set(['LIKE', 'ILIKE', 'IN', 'IS', 'BETWEEN', 'EXISTS', 'REGEXP'])

const joinModifiers = new Set(['LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS', 'NATURAL', 'OUTER'])

export const statementKeywords = [
  'SELECT',
  'INSERT INTO',
  'UPDATE',
  'DELETE FROM',
  'WITH',
  'CREATE TABLE',
  'ALTER TABLE',
  'DROP TABLE',
  'TRUNCATE TABLE',
  'EXPLAIN',
  'BEGIN',
  'COMMIT',
  'ROLLBACK'
]

const valueStart = ['NOT', 'NULL', 'TRUE', 'FALSE', 'CASE']

const none: ClauseContext = { kind: 'none', keywords: [] }

export function clauseContext(statement: SqlToken[], position: number, driver: string): ClauseContext {
  const leading = statement.filter((token) => token.end <= position),
    trailing = statement.filter((token) => token.start > position)
  let depth = 0,
    open = -1

  for (let i = leading.length - 1; i >= 0 && open < 0; i--) {
    if (isPunct(leading[i], ')')) depth++
    else if (isPunct(leading[i], '(')) {
      if (depth) depth--
      else open = i
    }
  }

  const scope = leading.slice(open + 1)

  depth = 0
  const close = trailing.findIndex((token) => {
    if (isPunct(token, '(')) depth++
    else if (isPunct(token, ')')) {
      if (!depth) return true

      depth--
    }

    return false
  })
  const after = atoms(close < 0 ? trailing : trailing.slice(0, close))

  if (open >= 0) {
    const owner = keywordOf(leading[open - 1]),
      first = keywordOf(scope[0])

    if (!scope.length && (!leading[open - 1] || subqueryOwners.has(owner))) return keyword(['SELECT', 'WITH'])

    // Function arguments, column lists, and value tuples hold expressions rather than clauses.
    if (first !== 'SELECT' && first !== 'WITH') {
      const item = lastItem(atoms(scope))

      if (owner === 'VALUES') return expectsOperand(item) ? keyword(['NULL', 'DEFAULT', 'TRUE', 'FALSE']) : none

      return expression(item, item, valueStart) ?? none
    }
  }

  return clauseAt(atoms(scope), after, driver)
}

export function isPunct(token: SqlToken | undefined, text: string) {
  return token?.kind === 'punct' && token.text === text
}

export function keywordOf(token: SqlToken | undefined) {
  return token?.kind === 'keyword' ? token.text.toUpperCase() : ''
}

function clauseAt(leading: SqlToken[], trailing: SqlToken[], driver: string): ClauseContext {
  const marks = markers(leading)
  const current = marks.at(-1)

  if (!current) return leading.length ? none : keyword(statementKeywords)

  const flow = flowOf(marks),
    name = current.name
  const tail = leading.slice(current.end + 1)
  const next = following(flow, name, nextRank(markers(trailing), flow))
  const joins = flow === 'SELECT' ? joinWords(driver) : []
  const last = tail.at(-1),
    lastKeyword = keywordOf(last)

  // AS is followed by a new name, which nothing can suggest.
  if (lastKeyword === 'AS') return none

  if (joins.length && joinModifiers.has(lastKeyword))
    return keyword(['LEFT', 'RIGHT', 'FULL'].includes(lastKeyword) ? ['JOIN', 'OUTER JOIN'] : ['JOIN'])

  if (tableMarkers.has(name) && !(name === 'INTO' && flow !== 'INSERT'))
    return tableClause(name, tail, joins, next, keywordOf(leading[0]))

  switch (name) {
    case 'SELECT': {
      if (!tail.length) return column(['DISTINCT', ...valueStart])

      const item = lastItem(tail)

      return expression(item, tail, valueStart) ?? keyword([...(aliasable(item) ? ['AS'] : []), ...next])
    }

    case 'WHERE':
    case 'HAVING':
    case 'ON': {
      if (!flow) return tail.length ? none : { kind: 'table', keywords: [] }

      const segment = lastPredicate(tail)
      const words = segment.some(isComparison) ? ['AND', 'OR'] : [...predicateWords(driver), 'AND', 'OR']

      return (
        expression(segment, tail, ['NOT', 'EXISTS', ...valueStart.slice(1)]) ??
        keyword([...words, ...(name === 'ON' ? joins : []), ...next])
      )
    }

    case 'USING':
      if (flow !== 'SELECT') return tableClause(name, tail, joins, next, '')

      return tail.length ? keyword([...joins, ...next]) : none

    case 'GROUP BY':
    case 'RETURNING': {
      const item = lastItem(tail)

      return expression(item, tail, valueStart) ?? keyword(next)
    }

    case 'ORDER BY': {
      const item = lastItem(tail)
      const direction = item.some((token) => ['ASC', 'DESC'].includes(keywordOf(token)))

      return expression(item, tail, valueStart) ?? keyword([...(direction ? [] : ['ASC', 'DESC']), ...next])
    }

    case 'SET': {
      const item = lastItem(tail)

      if (!item.some((token) => token.kind === 'operator' && token.text === '=')) return item.length ? none : column([])

      return expression(item, tail, valueStart) ?? keyword(next)
    }

    case 'LIMIT':
    case 'OFFSET':
      return tail.length && !expectsOperand(tail) ? keyword(next) : none

    case 'VALUES':
      return last?.kind === 'group' ? keyword(next) : none

    case 'ON CONFLICT':
      if (lastKeyword === 'DO') return keyword(['NOTHING', 'UPDATE SET'])

      return keyword(tail.some((token) => keywordOf(token) === 'NOTHING') ? next : ['DO NOTHING', 'DO UPDATE SET'])

    case 'DELETE':
      return tail.length ? none : keyword(['FROM'])

    case 'INSERT':
      return tail.length ? none : keyword(['INTO'])

    case 'UNION':
    case 'INTERSECT':
    case 'EXCEPT':
      if (!tail.length) return keyword(['SELECT', 'ALL'])

      return tail.length === 1 && ['ALL', 'DISTINCT'].includes(lastKeyword) ? keyword(['SELECT']) : none

    case 'WITH':
      if (last?.kind === 'group') return keyword(['SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM'])

      return isName(last) ? keyword(['AS']) : none

    case 'CREATE':
      return tail.length ? none : keyword(['TABLE', 'INDEX', 'UNIQUE INDEX', 'VIEW'])

    case 'ALTER':
      return tail.length ? none : keyword(['TABLE'])

    case 'DROP':
      return tail.length ? none : keyword(['TABLE', 'INDEX', 'VIEW'])

    case 'EXPLAIN':
      return tail.every((token) => ['ANALYZE', 'VERBOSE'].includes(keywordOf(token)))
        ? keyword([...(tail.length ? [] : ['ANALYZE']), ...statementKeywords])
        : none
  }

  return none
}

function tableClause(name: string, tail: SqlToken[], joins: string[], next: string[], first: string): ClauseContext {
  const pending = tail.filter((token) => !referenceModifiers.has(keywordOf(token)))
  const last = pending.at(-1)

  if (!last) return first === 'CREATE' ? none : { kind: 'table', keywords: [] }

  if ((name === 'FROM' || name === 'USING') && isPunct(last, ',')) return { kind: 'table', keywords: [] }

  if (keywordOf(last) === 'AS') return none

  const alias = pending.some((token) => keywordOf(token) === 'AS') || aliased(pending) ? [] : ['AS']

  switch (name) {
    case 'FROM':
      return keyword([...alias, ...joins, ...next])

    case 'JOIN':
      return keyword(['ON', 'USING', ...alias, ...joins, ...next])

    case 'USING':
      return keyword([...alias, ...next])

    case 'UPDATE':
      return keyword([...alias, 'SET'])

    case 'INTO':
      return keyword(['VALUES', 'SELECT', 'DEFAULT VALUES'])

    case 'TABLE':
      return keyword(
        first === 'ALTER' ? ['ADD COLUMN', 'DROP COLUMN', 'ALTER COLUMN', 'RENAME TO', 'RENAME COLUMN'] : []
      )
  }

  return none
}

/** Handles positions inside an expression; `null` means the expression is complete. */

function expression(segment: SqlToken[], tail: SqlToken[], start: string[]): ClauseContext | null {
  const last = segment.at(-1),
    lastKeyword = keywordOf(last)

  if (lastKeyword === 'IN' || lastKeyword === 'EXISTS') return none

  if (lastKeyword === 'IS') return keyword(['NULL', 'NOT NULL', 'TRUE', 'FALSE'])

  if (lastKeyword === 'NOT' && keywordOf(segment.at(-2)) === 'IS') return keyword(['NULL', 'TRUE', 'FALSE'])

  if (expectsOperand(segment)) return column(start)

  let open = 0,
    branch = ''

  for (const token of tail) {
    const word = keywordOf(token)

    if (word === 'CASE') open++
    else if (word === 'END' && open) open--

    if (open && ['CASE', 'WHEN', 'THEN', 'ELSE'].includes(word)) branch = word
  }

  if (open) {
    if (branch === 'WHEN') return keyword(['THEN', 'AND', 'OR'])

    if (branch === 'THEN') return keyword(['WHEN', 'ELSE', 'END'])

    return keyword(branch === 'ELSE' ? ['END'] : ['WHEN'])
  }

  return null
}

function expectsOperand(segment: SqlToken[]) {
  const last = segment.at(-1)

  if (!last) return true

  if (last.kind === 'operator') return !(last.text === '*' && (segment.length === 1 || isPunct(segment.at(-2), '.')))

  return isPunct(last, ',') || operandKeywords.has(keywordOf(last))
}

function isComparison(token: SqlToken) {
  if (token.kind === 'operator') return /^(=|==|<>|!=|<=|>=|<|>|!?~\*?|@>|<@|&&)$/.test(token.text)

  return comparisonKeywords.has(keywordOf(token))
}

function predicateWords(driver: string) {
  return [
    'IN',
    'NOT IN',
    'LIKE',
    'NOT LIKE',
    ...(driver === 'postgresql' ? ['ILIKE'] : []),
    'IS NULL',
    'IS NOT NULL',
    'BETWEEN'
  ]
}

function joinWords(driver: string) {
  return ['JOIN', 'LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN', ...(driver === 'mysql' ? [] : ['FULL JOIN']), 'CROSS JOIN']
}

/** Collapses balanced parentheses into single tokens so clause keywords inside them are ignored. */

function atoms(tokens: SqlToken[]) {
  const result: SqlToken[] = []
  let depth = 0,
    start = 0

  for (const token of tokens) {
    if (isPunct(token, '(')) {
      if (!depth) start = token.start

      depth++
    } else if (isPunct(token, ')') && depth) {
      depth--

      if (!depth) result.push({ kind: 'group', text: '()', start, end: token.end })
    } else if (!depth) result.push(token)
  }

  return result
}

function markers(tokens: SqlToken[]) {
  const found: Marker[] = []

  tokens.forEach((token, index) => {
    const word = keywordOf(token),
      next = keywordOf(tokens[index + 1])

    if ((word === 'GROUP' || word === 'ORDER') && next === 'BY') found.push({ name: `${word} BY`, end: index + 1 })
    else if (word === 'ON' && next === 'CONFLICT') found.push({ name: 'ON CONFLICT', end: index + 1 })
    else if (word === 'ON' && keywordOf(tokens[index - 1]) === 'DISTINCT') return
    else if (markerNames.has(word)) found.push({ name: word, end: index })
  })

  return found
}

function flowOf(marks: Marker[]) {
  for (let i = marks.length - 1; i >= 0; i--) if (starters[marks[i].name]) return starters[marks[i].name]

  return ''
}

function rankOf(flow: string, name: string) {
  const clause = flow === 'SELECT' && ['JOIN', 'ON', 'USING'].includes(name) ? 'FROM' : name

  return flows[flow]?.indexOf(clause) ?? -1
}

function nextRank(marks: Marker[], flow: string) {
  let rank = Infinity

  for (const mark of marks) {
    if (starters[mark.name]) break

    const value = rankOf(flow, mark.name)

    if (value >= 0) rank = Math.min(rank, value)
  }

  return rank
}

function following(flow: string, name: string, limit: number) {
  const order = flows[flow] ?? [],
    rank = rankOf(flow, name)

  if (rank < 0) return []

  const next = order.filter((_, index) => index > rank && index < limit)

  if (flow !== 'SELECT') return next

  if (name === 'SELECT') return next.slice(0, 1)

  // Set operations may follow any clause from FROM through HAVING.
  if (rank >= 1 && rank <= 4) {
    const split = next.findIndex((clause) => order.indexOf(clause) > 4)
    const at = split < 0 ? next.length : split

    return [...next.slice(0, at), 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT', ...next.slice(at)]
  }

  return next
}

function lastItem(tail: SqlToken[]) {
  let index = tail.length

  while (index > 0 && !isPunct(tail[index - 1], ',')) index--

  return tail.slice(index)
}

function lastPredicate(tail: SqlToken[]) {
  let start = 0,
    between = false

  tail.forEach((token, index) => {
    const word = keywordOf(token)

    if (word === 'BETWEEN') between = true
    else if (word === 'AND' && between) between = false
    else if (word === 'AND' || word === 'OR') start = index + 1
  })

  return tail.slice(start)
}

function aliased(item: SqlToken[]) {
  const last = item.at(-1),
    previous = item.at(-2)

  return !!previous && isName(last) && !['punct', 'operator', 'keyword'].includes(previous.kind)
}

function aliasable(item: SqlToken[]) {
  const last = item.at(-1)
  const star = last?.kind === 'operator' && last.text === '*'

  return !star && !aliased(item) && !item.some((token) => keywordOf(token) === 'AS')
}

function isName(token: SqlToken | undefined) {
  return token?.kind === 'word' || token?.kind === 'identifier'
}

function keyword(keywords: string[]): ClauseContext {
  return keywords.length ? { kind: 'keyword', keywords } : none
}

function column(keywords: string[]): ClauseContext {
  return { kind: 'column', keywords }
}
