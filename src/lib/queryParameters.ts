import { highlightSql } from './sqlHighlight.ts'
import type { QueryParameter } from '../types/query.ts'

export function parameterNames(sql: string): string[] {
  return [
    ...new Set(
      highlightSql(sql).flatMap((token) =>
        token.kind === 'parameter' ? [...token.text.matchAll(/:([A-Za-z_]\w*)/g)].map((match) => match[1]) : []
      )
    )
  ]
}

export function activeParameters(sql: string, parameters: QueryParameter[]): QueryParameter[] {
  return parameterNames(sql).map(
    (name) => parameters.find((parameter) => parameter.name === name) ?? { name, type: 'text', value: '' }
  )
}

export function inferParameter(name: string, value: string): QueryParameter {
  const trimmed = value.trim()
  const type = /^null$/i.test(trimmed)
    ? 'null'
    : /^(true|false)$/i.test(trimmed)
      ? 'boolean'
      : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)
        ? 'number'
        : 'text'

  return { name, type, value: type === 'text' ? value : trimmed.toLowerCase() }
}

// Encode text as bytes rather than relying on server-specific string escape modes.
export function parameterSql(sql: string, parameters: QueryParameter[], driver: string): string {
  const values = new Map(parameters.map((parameter) => [parameter.name, parameter]))

  return highlightSql(sql)
    .map((token) => {
      if (token.kind !== 'parameter') return token.text

      return token.text.replace(/:([A-Za-z_]\w*)/g, (_, name: string) => {
        const parameter = values.get(name)
        if (!parameter) throw new Error(`Set a value for :${name}.`)
        if (parameter.type === 'null') return 'NULL'
        if (parameter.type === 'number') {
          if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(parameter.value))
            throw new Error(`Enter a valid number for :${name}.`)
          return `(${parameter.value})`
        }
        if (parameter.type === 'boolean') {
          if (!['true', 'false'].includes(parameter.value)) throw new Error(`Choose true or false for :${name}.`)
          return parameter.value.toUpperCase()
        }
        const hex = Array.from(new TextEncoder().encode(parameter.value), (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('')
        if (driver === 'postgresql') return `convert_from(decode('${hex}', 'hex'), 'UTF8')`
        if (driver === 'mysql') return `CONVERT(X'${hex}' USING utf8mb4)`
        if (driver === 'sqlite') return `CAST(X'${hex}' AS TEXT)`
        throw new Error('Unsupported driver')
      })
    })
    .join('')
}
