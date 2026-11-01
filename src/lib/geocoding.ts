export interface GeocodingResult {
  id: number
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!response.ok) throw new Error(`Open-Meteo geocoding request failed (${response.status})`)
  const data = await response.json()
  return data.results ?? []
}
