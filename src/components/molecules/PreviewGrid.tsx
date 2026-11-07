import type { GridPreview } from '../../lib/tabPreview'
import { NullValue } from '../atoms/NullValue'

export function PreviewGrid({ grid }: { grid: GridPreview }) {
  return (
    <div className="preview-grid">
      <table>
        <thead>
          <tr>
            {grid.columns.map((column, index) => (
              <th key={index}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, index) => (
                <td key={index}>{value === null ? <NullValue /> : value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!grid.rows.length && <p className="tab-preview-note">No rows</p>}
    </div>
  )
}
