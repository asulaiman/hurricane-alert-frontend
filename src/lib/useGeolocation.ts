import { useCallback, useState } from 'react'

export interface Coordinates {
  latitude: number
  longitude: number
}

export type GeolocationStatus = 'idle' | 'locating' | 'success' | 'error'

interface GeolocationState {
  status: GeolocationStatus
  coords: Coordinates | null
  error: string | null
}

function describeError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location access was denied. Search for a location manually instead.'
    case err.POSITION_UNAVAILABLE:
      return 'Your location could not be determined. Search for a location manually instead.'
    case err.TIMEOUT:
      return 'Location request timed out. Try again or search manually.'
    default:
      return 'Could not get your location. Search for a location manually instead.'
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    status: 'idle',
    coords: null,
    error: null,
  })

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', coords: null, error: 'Geolocation is not supported by this browser.' })
      return
    }

    setState((prev) => ({ ...prev, status: 'locating', error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: 'success',
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          error: null,
        })
      },
      (err) => {
        setState({ status: 'error', coords: null, error: describeError(err) })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  const setManualCoords = useCallback((coords: Coordinates) => {
    setState({ status: 'success', coords, error: null })
  }, [])

  return { ...state, locate, setManualCoords }
}
