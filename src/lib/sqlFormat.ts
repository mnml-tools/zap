import { highlightSql, isSqlKeyword } from './sqlHighlight.ts'

/** A token plus the whitespace that preceded it in the source. `word` is set only for bare words. */

type Atom = {
  text: string
  kind: 'word' | 'operator' | 'comment' | 'other'
  space: boolean
  newline: boolean
  word: string
}

type Pending = { indent: number; blank: boolean; keep: Set<string> }

type Scope = {
  type: 'scope'
  base: number
  close: number
  clause: string
  count: number
  first: string
  table: boolean
  parens: number
  between: boolean
  joined: boolean
}

type Frame =
  | Scope
  | { type: 'paren'; resume: Pending | null }
  | { type: 'list'; base: number; close: number }
  | { type: 'case'; base: number }

// Clauses whose content moves to its own indented line, with one item per line.
const blockClauses = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP',
  'HAVING',
  'ORDER',
  'SET',
  'RETURNING',
  'VALUES',
  'WITH',
  'INSERT',
  'UPDATE',
  'DELETE',
  'DUPLICATE',
  'WINDOW'
])

const listClauses = new Set([...blockClauses].filter((clause) => !['WHERE', 'HAVING', 'INSERT'].includes(clause)))

// Words that stay on the clause line, such as SELECT DISTINCT or INSERT INTO.
const clauseWords: Record<string, string[]> = {
  SELECT: ['DISTINCT', 'ALL', 'ON'],
  WITH: ['RECURSIVE'],
  INSERT: ['IGNORE', 'INTO'],
  REPLACE: ['INTO'],
  DELETE: ['FROM'],
  GROUP: ['BY'],
  ORDER: ['BY'],
  DUPLICATE: ['DUPLICATE', 'KEY', 'UPDATE']
}

const joinWords = new Set(['LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS', 'NATURAL', 'OUTER', 'JOIN', 'STRAIGHT_JOIN'])

const nothing = new Set<string>()

// Keywords that cannot be bare names in MySQL, or that commonly follow a table reference; always uppercased.
const reserved = new Set(
  `SELECT FROM WHERE AS AND OR NOT NULL IS IN LIKE ILIKE BETWEEN EXISTS DISTINCT ALL UNION INTERSECT EXCEPT JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL ON USING WITH RECURSIVE GROUP BY HAVING ORDER ASC DESC LIMIT OFFSET FETCH FOR UPDATE INSERT INTO VALUES DEFAULT DELETE RETURNING SET CREATE ALTER DROP TABLE UNIQUE PRIMARY KEY FOREIGN REFERENCES CONSTRAINT CHECK ADD COLUMN RENAME TO IF CASCADE RESTRICT CASE WHEN THEN ELSE TRUE FALSE COLLATE OVER PARTITION WINDOW LATERAL EXPLAIN ANALYZE DUPLICATE`.split(
    ' '
  )
)

// Words after these name a table or an alias.
const nameIntroducers = new Set(['FROM', 'JOIN', 'STRAIGHT_JOIN', 'UPDATE', 'INTO', 'TABLE', 'EXISTS', 'ONLY', 'AS'])

const tableIntroducers = new Set([...nameIntroducers].filter((word) => word !== 'AS'))

const conversions = new Set(['CAST', 'TRY_CAST', 'CONVERT'])

/**
 * Lays SQL out one clause per line and uppercases keywords. Otherwise only whitespace between tokens changes:
 * strings, comments and identifiers are kept, tokens that were separated stay separated, and a line comment always
 * ends its line.
 */

export function formatSql(sql: string, indentSize = 2): string {
  const atoms = atomize(sql)
  const lines = [{ indent: 0, text: '' }]
  let frames: Frame[] = [scope(0, 0)],
    pending: Pending | null = null,
    force = false

  const line = () => lines[lines.length - 1]

  const newline = (indent: number, blank = false) => {
    if (!line().text) {
      line().indent = indent
      return
    }

    if (blank) lines.push({ indent: 0, text: '' })

    lines.push({ indent, text: '' })
  }

  const breakTo = (indent: number) => {
    const blank = !!pending?.blank
    pending = null
    force = false
    newline(indent, blank)
  }

  const flush = () => {
    if (pending) breakTo(pending.indent)
  }

  const emit = (atom: Atom) => {
    if (force) {
      force = false
      newline(line().indent)
    }

    const current = line()
    current.text += (current.text && atom.space ? ' ' : '') + atom.text
  }

  const significant = (from: number, step: 1 | -1) => {
    for (let index = from; index >= 0 && index < atoms.length; index += step)
      if (atoms[index].kind !== 'comment') return index

    return -1
  }

  atoms.forEach((atom, index) => {
    const top = frames[frames.length - 1]

    if (atom.kind === 'comment') {
      // A comment on its own line stays there; a trailing one stays after its code.
      if (atom.newline && !force) {
        if (pending) flush()
        else newline(line().indent)
      }

      emit(atom)
      force ||= endsWithLineComment(atom.text)
      return
    }

    const previousIndex = significant(index - 1, -1)
    const previous = atoms[previousIndex],
      next = atoms[significant(index + 1, 1)]
    const word = atom.word

    if (pending && word && pending.keep.has(word)) {
      emit(atom)
    } else if (atom.text === '(') {
      const subquery = ['SELECT', 'WITH', 'VALUES'].includes(next?.word ?? '')
      const columns = top.type === 'scope' && top.first === 'CREATE' && top.table && !top.parens

      if (top.type === 'scope') top.parens++

      if (subquery || columns) {
        flush()
        emit(atom)
        const indent = line().indent
        frames.push(subquery ? scope(indent + 1, indent) : { type: 'list', base: indent + 1, close: indent })
        pending = { indent: indent + 1, blank: false, keep: nothing }
      } else if (pending?.keep.has('ON') && previous?.word === 'ON') {
        // SELECT DISTINCT ON (...) keeps its expression on the SELECT line.
        frames.push({ type: 'paren', resume: pending })
        pending = null
        emit(atom)
      } else {
        flush()
        emit(atom)
        frames.push({ type: 'paren', resume: null })
      }
    } else if (atom.text === ')') {
      let at = frames.length - 1

      while (at > 0 && frames[at].type === 'case') at--

      if (at === 0) {
        flush()
        emit(atom)
      } else {
        const frame = frames[at]
        frames = frames.slice(0, at)

        if (frame.type === 'paren') {
          flush()
          emit(atom)
          pending = frame.resume
        } else {
          breakTo('close' in frame ? frame.close : 0)
          emit(atom)
        }
      }
    } else if (atom.text === ';') {
      frames = [scope(0, 0)]
      pending = null
      emit(atom)
      pending = { indent: 0, blank: true, keep: nothing }
    } else if (top.type === 'case' && (word === 'WHEN' || word === 'ELSE')) {
      breakTo(top.base)
      emit(atom)
    } else if (top.type === 'case' && word === 'END') {
      frames.pop()
      breakTo(top.base - 1)
      emit(atom)
    } else if (word === 'CASE') {
      flush()
      emit(atom)
      frames.push({ type: 'case', base: line().indent + 1 })
    } else if (top.type === 'list' && atom.text === ',') {
      flush()
      emit(atom)
      pending = { indent: top.base, blank: false, keep: nothing }
    } else if (top.type === 'scope') {
      const operand = previous && (previous.text === ',' || (previous.kind === 'operator' && previous.text !== '*'))
      const clause =
        operand || !word ? '' : clauseOf(top, word, previous, atoms[significant(previousIndex - 1, -1)], next)

      if (!top.count) top.first = word
      if (word === 'TABLE') top.table = true

      if (clause) {
        top.between = top.joined = false

        if (clause === 'SET' && top.clause !== 'UPDATE') {
          // ON CONFLICT ... DO UPDATE SET keeps SET on the conflict line.
          flush()
        } else breakTo(top.base)

        emit(atom)
        top.clause = clause

        if (blockClauses.has(clause))
          pending = {
            indent: top.base + 1,
            blank: false,
            keep: new Set(clauseWords[word] ?? clauseWords[clause] ?? [])
          }
      } else if (word && joinWords.has(word) && !joinWords.has(previous?.word ?? '') && startsJoin(atoms, index)) {
        breakTo(top.base + 1)
        emit(atom)
        top.joined = false
      } else if ((word === 'AND' || word === 'OR') && !operand && !(word === 'AND' && top.between)) {
        if (top.clause === 'WHERE' || top.clause === 'HAVING') breakTo(top.base + 1)
        else if (top.joined && ['FROM', 'UPDATE', 'DELETE'].includes(top.clause)) breakTo(top.base + 2)
        else flush()

        emit(atom)
      } else if (atom.text === ',' && listClauses.has(top.clause)) {
        flush()
        emit(atom)
        pending = { indent: top.base + 1, blank: false, keep: nothing }
      } else {
        flush()
        emit(atom)

        if (word === 'BETWEEN') top.between = true
        else if (word === 'AND') top.between = false
        else if (word === 'ON') top.joined = true
      }
    } else {
      flush()
      emit(atom)
    }

    if (top.type === 'scope') top.count++
  })

  const unit = ' '.repeat(indentSize)

  return lines.map((item) => (item.text ? unit.repeat(item.indent) + item.text : '')).join('\n')
}

/**
 * Moves a cursor from `source` to the same code position in `formatted`, which differs only in whitespace. A cursor
 * after whitespace stays before the next token; otherwise it stays after the previous one.
 */

export function formattedPosition(source: string, formatted: string, position: number) {
  let count = 0

  for (let index = 0; index < position; index++) if (!/\s/.test(source[index])) count++

  const after = position > 0 && /\s/.test(source[position - 1])

  if (!count && !after) return 0

  for (let index = 0; index < formatted.length; index++) {
    if (/\s/.test(formatted[index])) continue

    if (after ? !count : count === 1) return after ? index : index + 1

    count--
  }

  return formatted.length
}

function scope(base: number, close: number): Scope {
  return {
    type: 'scope',
    base,
    close,
    clause: '',
    count: 0,
    first: '',
    table: false,
    parens: 0,
    between: false,
    joined: false
  }
}

function clauseOf(scope: Scope, word: string, previous?: Atom, before?: Atom, next?: Atom) {
  const start = !scope.count,
    afterCte = scope.clause === 'WITH' && previous?.text === ')'

  switch (word) {
    case 'SELECT':
    case 'WHERE':
    case 'HAVING':
    case 'RETURNING':
    case 'WINDOW':
    case 'LIMIT':
    case 'OFFSET':
    case 'FETCH':
    case 'UNION':
    case 'INTERSECT':
    case 'EXCEPT':
      return word

    case 'WITH':
      return start ? word : ''

    case 'INSERT':
    case 'REPLACE':
    case 'UPDATE':
    case 'DELETE':
      return start || afterCte ? (word === 'REPLACE' ? 'INSERT' : word) : ''

    case 'VALUES':
      return start || (scope.clause === 'INSERT' && previous?.word !== 'DEFAULT') ? word : ''

    // IS [NOT] DISTINCT FROM compares values.
    case 'FROM':
      return previous?.word === 'DISTINCT' ? '' : word

    case 'GROUP':
    case 'ORDER':
      return next?.word === 'BY' ? word : ''

    case 'SET':
      return scope.clause === 'UPDATE' || (previous?.word === 'UPDATE' && before?.word === 'DO') ? word : ''

    case 'FOR':
      return ['UPDATE', 'SHARE', 'NO', 'KEY'].includes(next?.word ?? '') ? word : ''

    case 'ON':
      return next?.word === 'CONFLICT' ? 'CONFLICT' : next?.word === 'DUPLICATE' ? 'DUPLICATE' : ''
  }

  return ''
}

function startsJoin(atoms: Atom[], index: number) {
  for (let at = index; at < atoms.length && joinWords.has(atoms[at].word); at++)
    if (atoms[at].word === 'JOIN' || atoms[at].word === 'STRAIGHT_JOIN') return true

  return false
}

function atomize(sql: string) {
  const atoms: Atom[] = []
  let space = false,
    newline = false

  const add = (text: string, kind: Atom['kind']) => {
    atoms.push({ text, kind, space, newline, word: '' })
    space = newline = false
  }

  for (const token of highlightSql(sql)) {
    if (token.kind === 'comment' || token.kind === 'operator') add(token.text, token.kind)
    else if (token.kind === 'text' || token.kind === 'keyword' || token.kind === 'function') {
      for (const [part] of token.text.matchAll(/\s+|[\p{L}_][\p{L}\p{N}_$]*|[\s\S]/gu)) {
        if (/^\s/.test(part)) {
          space = true
          newline ||= part.includes('\n')
        } else add(part, /^[\p{L}_]/u.test(part) ? 'word' : 'other')
      }
    } else add(token.text, 'other')
  }

  // Words glued to names or qualifiers, as in `t.from` or `1from`, are never treated as keywords.
  atoms.forEach((atom, index) => {
    const previous = atoms[index - 1],
      next = atoms[index + 1]
    const glued =
      (!atom.space && /[\p{L}\p{N}_$.]$/u.test(previous?.text ?? '')) ||
      (!next?.space && /^[\p{L}\p{N}_$.]/u.test(next?.text ?? ''))

    if (atom.kind === 'word' && !glued) atom.word = atom.text.toUpperCase()
  })

  uppercaseKeywords(atoms)

  return atoms
}

// Merged comment tokens are block comments optionally followed by one line comment.
function endsWithLineComment(text: string) {
  let index = 0

  while (text.startsWith('/*', index)) {
    let depth = 0

    do {
      if (text.startsWith('/*', index)) {
        depth++
        index += 2
      } else if (text.startsWith('*/', index)) {
        depth--
        index += 2
      } else index++
    } while (depth && index < text.length)
  }

  return index < text.length
}

/**
 * MySQL table names and aliases are case-sensitive on most systems, so a keyword that is also used as a name, as in
 * `FROM date d`, `orders AS first` or `date.id`, keeps the casing it was written with everywhere in the SQL.
 */

function uppercaseKeywords(atoms: Atom[]) {
  const names = new Set<string>(),
    parens: string[] = []
  let previous: Atom | undefined, before: Atom | undefined

  for (const atom of atoms) {
    if (atom.kind === 'comment') continue

    if (atom.text === '(') parens.push(previous?.word ?? '')
    else if (atom.text === ')') parens.pop()

    if (atom.kind === 'word') {
      const named =
        !reserved.has(previous?.word ?? '') && (previous?.kind === 'word' || /^["`[]/.test(previous?.text ?? ''))
      const conversion = previous?.word === 'AS' && conversions.has(parens[parens.length - 1])

      if (
        !atom.word ||
        (nameIntroducers.has(previous?.word ?? '') && !conversion) ||
        (tableIntroducers.has(before?.word ?? '') && named)
      )
        names.add(atom.text.toUpperCase())
    }

    before = previous
    previous = atom
  }

  for (const atom of atoms) {
    const word = atom.word

    if (word && (reserved.has(word) || (isSqlKeyword(word) && !names.has(word)))) atom.text = word
  }
}
