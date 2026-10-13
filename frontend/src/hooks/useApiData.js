import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios'

// GET `path` (with query `params`) and keep the single JSON object in state.
// Like useApiList, but for endpoints that return an object. `data` is null until the first answer
// (and after a failed one); `reload()` re-runs the request after a change.
export function useApiData(path, params = {}) {
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: '' })

  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  const paramKey = JSON.stringify(clean)
  const key = `${path}|${paramKey}|${reloadKey}`

  useEffect(() => {
    const controller = new AbortController()
    api
      .get(path, { params: JSON.parse(paramKey), signal: controller.signal })
      .then((res) => setResult({ key, data: res.data, error: '' }))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return
        setResult({ key, data: null, error: err.response?.data?.message || 'Could not load this section. Is the backend running?' })
      })
    return () => controller.abort()
  }, [key, path, paramKey])

  const reload = useCallback(() => setReloadKey((n) => n + 1), [])

  return { data: result.data, error: result.error, loading: result.key !== key, firstLoad: result.key === null, reload }
}
