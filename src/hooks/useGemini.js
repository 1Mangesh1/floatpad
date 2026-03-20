// src/hooks/useGemini.js
import { useState } from 'react'
import { workerPost } from '../lib/workerClient'

export function useGemini() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ask = async (prompt) => {
    setLoading(true)
    setError(null)
    try {
      const data = await workerPost('/gemini', { prompt })
      return data.text ?? null
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return { ask, loading, error }
}
