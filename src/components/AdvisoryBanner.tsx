import type { Advisory } from '../lib/weather'

export function AdvisoryBanner({ advisory }: { advisory: Advisory }) {
  return (
    <div className="advisory-banner" style={{ borderColor: advisory.color }}>
      <span className="advisory-dot" style={{ backgroundColor: advisory.color }} />
      <div>
        <h2 style={{ color: advisory.color }}>{advisory.label}</h2>
        <p>{advisory.description}</p>
      </div>
    </div>
  )
}
