import { Zap } from 'lucide-react'

export function BrandMark() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Zap size={19} fill="currentColor" />
      </span>
      zap<span className="brand-note">database explorer</span>
    </div>
  )
}
