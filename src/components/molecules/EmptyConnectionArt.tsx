import { Database } from 'lucide-react'

export function EmptyConnectionArt() {
  return (
    <div className="empty-art">
      <div className="art-line one" />
      <div className="art-line two" />
      <div className="art-db">
        <Database size={42} strokeWidth={1} />
        <span />
        <span />
      </div>
      <span className="art-plus">+</span>
      <span className="art-dot" />
    </div>
  )
}
