import { Plus } from 'lucide-react'
import { Button } from '../atoms/Button'
import { EmptyConnectionArt } from '../molecules/EmptyConnectionArt'

export function ConnectionsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty">
      <EmptyConnectionArt />
      <h2>No connections</h2>
      <p>Add a database to start browsing tables.</p>
      <Button className="primary" onClick={onCreate}>
        <Plus size={16} />
        Add connection
      </Button>
      <div className="supported">
        PostgreSQL <span>·</span> MySQL <span>·</span> SQLite
      </div>
    </div>
  )
}
