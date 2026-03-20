// src/hooks/useCFCrawl.js
import { useState } from 'react'
import { workerPost } from '../lib/workerClient'

export function useCFCrawl() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const crawl = async (url) => {
    setLoading(true)
    setError(null)
    try {
      const data = await workerPost('/crawl', { url })
      return data.text ?? null
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  return { crawl, loading, error }
}
