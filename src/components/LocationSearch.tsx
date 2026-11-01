import { useState } from 'react'
import { searchLocations, type GeocodingResult } from '../lib/openMeteo'

export function LocationSearch({
  onSelect,
}: {
  onSelect: (result: GeocodingResult) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      const found = await searchLocations(query.trim())
      setResults(found)
      if (found.length === 0) setError('No matching locations found.')
    } catch {
      setError('Location search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="location-search">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search city, e.g. Miami, FL"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(result)
                  setResults([])
                  setQuery('')
                }}
              >
                {result.name}
                {result.admin1 ? `, ${result.admin1}` : ''}
                {result.country ? `, ${result.country}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
