import { useCallback, useEffect, useState } from 'react'
import { useGeolocation, type Coordinates } from './lib/useGeolocation'
import { fetchForecast, type ForecastResult } from './lib/weather'
import type { GeocodingResult } from './lib/geocoding'
import { AdvisoryBanner } from './components/AdvisoryBanner'
import { ForecastDetails } from './components/ForecastDetails'
import { LocationSearch } from './components/LocationSearch'
import { OfficialAlerts } from './components/OfficialAlerts'
import { AlertSignup } from './components/AlertSignup'

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export default function App() {
  const geo = useGeolocation()
  const [locationLabel, setLocationLabel] = useState<string | null>(null)
  const [forecast, setForecast] = useState<ForecastResult | null>(null)
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadForecast = useCallback(async (coords: Coordinates) => {
    setFetchStatus('loading')
    setFetchError(null)
    try {
      const result = await fetchForecast(coords)
      setForecast(result)
      setFetchStatus('success')
    } catch {
      setFetchStatus('error')
      setFetchError('Could not load forecast data. Try refreshing.')
    }
  }, [])

  useEffect(() => {
    if (geo.coords) {
      loadForecast(geo.coords)
    }
  }, [geo.coords, loadForecast])

  function handleUseMyLocation() {
    setLocationLabel('Current Location')
    geo.locate()
  }

  function handleSelectLocation(result: GeocodingResult) {
    const label = [result.name, result.admin1, result.country].filter(Boolean).join(', ')
    setLocationLabel(label)
    geo.setManualCoords({ latitude: result.latitude, longitude: result.longitude })
  }

  const advisory = forecast?.advisory

  return (
    <div className="app">
      <header>
        <h1>Hurricane Alert</h1>
        <p className="tagline">Forecast-based storm advisories from Open-Meteo</p>
      </header>

      <section className="location-controls">
        <button type="button" onClick={handleUseMyLocation} disabled={geo.status === 'locating'}>
          {geo.status === 'locating' ? 'Locating…' : 'Use My Location'}
        </button>
        <LocationSearch onSelect={handleSelectLocation} />
        {geo.error && <p className="error-text">{geo.error}</p>}
      </section>

      {locationLabel && geo.coords && (
        <p className="current-location">
          Showing advisories for <strong>{locationLabel}</strong>
          {' '}
          ({geo.coords.latitude.toFixed(2)}, {geo.coords.longitude.toFixed(2)})
          <button type="button" className="refresh-link" onClick={() => loadForecast(geo.coords!)}>
            Refresh
          </button>
        </p>
      )}

      {fetchStatus === 'loading' && <p>Loading forecast…</p>}
      {fetchStatus === 'error' && <p className="error-text">{fetchError}</p>}

      {geo.coords && <OfficialAlerts coords={geo.coords} />}

      {forecast && advisory && (
        <>
          <AdvisoryBanner advisory={advisory} />
          <ForecastDetails current={forecast.current} advisory={advisory} timezone={forecast.timezone} />
        </>
      )}

      {geo.coords && <AlertSignup coords={geo.coords} locationLabel={locationLabel} />}

      <footer>
        <p>
          Advisories are generated from Open-Meteo forecast data using thresholds we define ourselves.
          This is not an official alert from the National Hurricane Center or your local weather service —
          always follow guidance from local authorities during a storm.
        </p>
      </footer>
    </div>
  )
}
