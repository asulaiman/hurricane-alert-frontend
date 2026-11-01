import type { Advisory } from '../lib/advisory'
import type { CurrentConditions } from '../lib/openMeteo'

function formatTime(iso: string, timezone: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    })
  } catch {
    return iso
  }
}

export function ForecastDetails({
  current,
  advisory,
  timezone,
}: {
  current: CurrentConditions
  advisory: Advisory
  timezone: string
}) {
  return (
    <div className="details-grid">
      <div className="detail-card">
        <h3>Right Now</h3>
        <dl>
          <div>
            <dt>Sustained Wind</dt>
            <dd>{current.windSpeed.toFixed(0)} mph</dd>
          </div>
          <div>
            <dt>Gusts</dt>
            <dd>{current.windGusts.toFixed(0)} mph</dd>
          </div>
          <div>
            <dt>Precipitation</dt>
            <dd>{current.precipitation.toFixed(2)} in</dd>
          </div>
          <div>
            <dt>Pressure</dt>
            <dd>{current.surfacePressure.toFixed(0)} hPa</dd>
          </div>
        </dl>
      </div>
      <div className="detail-card">
        <h3>Next 48 Hours</h3>
        <dl>
          <div>
            <dt>Peak Sustained Wind</dt>
            <dd>
              {advisory.maxSustainedWind.value.toFixed(0)} mph
              <span className="detail-time"> · {formatTime(advisory.maxSustainedWind.time, timezone)}</span>
            </dd>
          </div>
          <div>
            <dt>Peak Gust</dt>
            <dd>
              {advisory.maxGust.value.toFixed(0)} mph
              <span className="detail-time"> · {formatTime(advisory.maxGust.time, timezone)}</span>
            </dd>
          </div>
          <div>
            <dt>Next 24h Rainfall</dt>
            <dd>
              {advisory.next24hPrecipitation.toFixed(1)} in
              {advisory.flashFloodRisk && <span className="flag"> Flash flood risk</span>}
            </dd>
          </div>
          {advisory.pressureDropLast3h !== null && (
            <div>
              <dt>Pressure Trend (3h)</dt>
              <dd>
                {advisory.pressureDropLast3h > 0 ? '−' : '+'}
                {Math.abs(advisory.pressureDropLast3h).toFixed(1)} hPa
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
