// src/lib/workerClient.js
const BASE = import.meta.env.VITE_CF_WORKER_URL
const SECRET = import.meta.env.VITE_WORKER_SECRET

export async function workerPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-FloatPad-Secret': SECRET ?? '',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Worker error ${res.status}: ${err}`)
  }
  return res.json()
}
