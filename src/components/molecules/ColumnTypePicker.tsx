import { ChevronsUpDown } from 'lucide-react'

const typesByDriver: Record<string, string[]> = {
  postgresql: [
    'bigint',
    'boolean',
    'bytea',
    'character',
    'character varying',
    'date',
    'double precision',
    'integer',
    'interval',
    'json',
    'jsonb',
    'numeric',
    'real',
    'smallint',
    'text',
    'time',
    'time with time zone',
    'timestamp',
    'timestamp with time zone',
    'uuid',
    'xml'
  ],
  mysql: [
    'BIGINT',
    'BINARY',
    'BIT',
    'BLOB',
    'CHAR',
    'DATE',
    'DATETIME',
    'DECIMAL',
    'DOUBLE',
    'ENUM',
    'FLOAT',
    'INT',
    'JSON',
    'LONGBLOB',
    'LONGTEXT',
    'MEDIUMBLOB',
    'MEDIUMINT',
    'MEDIUMTEXT',
    'SET',
    'SMALLINT',
    'TEXT',
    'TIME',
    'TIMESTAMP',
    'TINYBLOB',
    'TINYINT',
    'TINYTEXT',
    'VARBINARY',
    'VARCHAR',
    'YEAR'
  ],
  sqlite: ['ANY', 'BLOB', 'INT', 'INTEGER', 'REAL', 'TEXT']
}

const shortTypes: Record<string, string> = {
  integer: 'int',
  'character varying': 'varchar',
  character: 'char',
  boolean: 'bool',
  'double precision': 'float8',
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  'time with time zone': 'timetz',
  'time without time zone': 'time'
}

function shortType(type: string) {
  const match = /^(timestamp|time)(\(\d+\))? (with|without) time zone(.*)$/i.exec(type)
  if (match)
    return shortTypes[`${match[1].toLowerCase()} ${match[3].toLowerCase()} time zone`] + (match[2] ?? '') + match[4]

  const base = type.split(/[([]/, 1)[0]
  return (shortTypes[base.toLowerCase()] ?? base) + type.slice(base.length)
}

type Props = {
  driver?: string
  value: string
  column: string
  saving: boolean
  editable?: boolean
  onSelect: (type: string) => void
  onManual: () => void
}

export function ColumnTypePicker({
  driver,
  value,
  column,
  saving,
  editable = driver === 'postgresql',
  onSelect,
  onManual
}: Props) {
  const options = typesByDriver[driver ?? ''] ?? []

  return (
    <label className="column-type-picker" title={value}>
      <select
        aria-label={`Data type for ${column}`}
        value={value}
        disabled={saving}
        onChange={(event) => {
          const selection = event.target.selectedOptions[0]
          if (selection.dataset.manual) onManual()
          else onSelect(selection.value)
        }}
      >
        {!options.includes(value) && <option value={value}>{shortType(value)}</option>}
        <optgroup label={editable ? 'Data types' : 'Data types (reference only)'}>
          {options.map((type) => (
            <option key={type} value={type} disabled={!editable && type !== value}>
              {shortType(type)}
            </option>
          ))}
        </optgroup>
        {editable && (
          <option value="" data-manual="true">
            Manual input…
          </option>
        )}
      </select>
      <ChevronsUpDown size={13} aria-hidden="true" />
    </label>
  )
}
