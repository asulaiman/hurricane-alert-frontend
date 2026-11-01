import { apiUrl } from './api'
import type { Coordinates } from './useGeolocation'

export interface CurrentConditions {
  time: string
  windSpeed: number
  windGusts: number
  precipitation: number
  surfacePressure: number
}

export interface Advisory {
  level: 0 | 1 | 2 | 3
  label: string
  description: string
  color: string
  maxSustainedWind: { value: number; time: string }
  maxGust: { value: number; time: string }
  next24hPrecipitation: number
  flashFloodRisk: boolean
  pressureDropLast3h: number | null
}

export interface ForecastResult {
  current: CurrentConditions
  advisory: Advisory
  timezone: string
}

export async function fetchForecast({ latitude, longitude }: Coordinates): Promise<ForecastResult> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) })
  const response = await fetch(apiUrl(`/api/forecast?${params}`))
  if (!response.ok) throw new Error(`Forecast request failed (${response.status})`)
  return response.json()
}
