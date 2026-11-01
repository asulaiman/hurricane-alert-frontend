import { useEffect, useState } from 'react'
import type { Coordinates } from '../lib/useGeolocation'

interface OfficialAlert {
  source: 'NWS' | 'GDACS'
  id: string
  title: string
  severity: string
  headline: string
  description: string
  effective: string | null
  expires: string | null
  url: string | null
}

type Status = 'idle' | 'loading' | 'success' | 'error'

export function OfficialAlerts({ coords }: { coords: Coordinates }) {
  const [alerts, setAlerts] = useState<OfficialAlert[]>([])
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const params = new URLSearchParams({ lat: String(coords.latitude), lon: String(coords.longitude) })
    fetch(`/api/alerts?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`request failed (${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setAlerts(data.alerts ?? [])
        setStatus('success')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [coords.latitude, coords.longitude])

  if (status === 'loading' || status === 'idle') return null
  if (status === 'error') return null // official alerts are supplementary; don't block the page on this
  if (alerts.length === 0) return null

  return (
    <div className="official-alerts">
      <h3>Official Alerts</h3>
      <ul>
        {alerts.map((alert) => (
          <li key={`${alert.source}-${alert.id}`} className="official-alert-item">
            <span className="official-alert-source">{alert.source}</span>
            <div>
              <strong>{alert.title}</strong>
              <span className="official-alert-severity"> · {alert.severity}</span>
              <p>{alert.headline}</p>
              {alert.url && (
                <a href={alert.url} target="_blank" rel="noreferrer">
                  Full details
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
