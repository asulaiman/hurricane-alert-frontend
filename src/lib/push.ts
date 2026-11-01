function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function subscribeToPush(subscriptionId: number): Promise<void> {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    throw new Error('Push notifications are not configured on this deployment.')
  }
  if (!isPushSupported()) {
    throw new Error('This browser does not support push notifications.')
  }

  await navigator.serviceWorker.register('/sw.js')
  // .register() resolves once the worker is registered, not once it's active —
  // subscribing against it too early fails with "no active Service Worker".
  const registration = await navigator.serviceWorker.ready
  const pushSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  })

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId, pushSubscription: pushSubscription.toJSON() }),
  })
  if (!response.ok) {
    throw new Error('Could not save push subscription.')
  }
}
