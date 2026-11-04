import { NullValue } from '../atoms/NullValue'

type Props = { columns: string[]; rows: (string | null)[][] }

export function ReadOnlyTable({ columns, rows }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th className="row-number">#</th>
          {columns.map((column, index) => (
            <th key={index}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td className="row-number">{index + 1}</td>
            {row.map((value, column) => (
              <td key={column} title={value ?? 'NULL'}>
                {value === null ? <NullValue /> : value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
