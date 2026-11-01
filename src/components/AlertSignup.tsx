import { useState } from 'react'
import type { Coordinates } from '../lib/useGeolocation'
import { isPushSupported, subscribeToPush } from '../lib/push'

const CONSENT_TEXT =
  "I want to receive storm advisories for this location by the channels selected below. " +
  'This is a safety alert service, not marketing — I can unsubscribe at any time.'

type Status = 'idle' | 'submitting' | 'done' | 'error'

export function AlertSignup({ coords, locationLabel }: { coords: Coordinates; locationLabel: string | null }) {
  const [wantsPush, setWantsPush] = useState(false)
  const [email, setEmail] = useState('')
  const [consented, setConsented] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const canSubmit = consented && (wantsPush || email.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('submitting')
    setMessage(null)

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: locationLabel,
          email: email.trim() || undefined,
          wantsPush,
          consentText: CONSENT_TEXT,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? `Signup failed (${response.status})`)
      }
      const data: { subscriptionId: number; requiresEmailVerification: boolean } = await response.json()

      if (wantsPush) {
        await subscribeToPush(data.subscriptionId)
      }

      const notes: string[] = []
      if (data.requiresEmailVerification) notes.push('Check your inbox to confirm your email.')
      if (wantsPush) notes.push('Browser push is active.')
      setMessage(notes.join(' ') || "You're subscribed.")
      setStatus('done')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="alert-signup">
        <p className="signup-success">{message}</p>
      </div>
    )
  }

  return (
    <form className="alert-signup" onSubmit={handleSubmit}>
      <h3>Get Notified</h3>
      <label className="signup-row">
        <input
          type="checkbox"
          checked={wantsPush}
          disabled={!isPushSupported()}
          onChange={(e) => setWantsPush(e.target.checked)}
        />
        Browser push notifications{!isPushSupported() && ' (not supported in this browser)'}
      </label>
      <label className="signup-row">
        Email address
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <label className="signup-row consent-row">
        <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
        {CONSENT_TEXT}
      </label>
      <button type="submit" disabled={!canSubmit || status === 'submitting'}>
        {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
      </button>
      {status === 'error' && <p className="error-text">{message}</p>}
    </form>
  )
}
