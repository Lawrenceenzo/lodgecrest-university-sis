import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios'

// GET `path` (with query `params`) and keep the list in state.
//  - `loading` is derived: true while the latest request hasn't answered yet.
//  - `firstLoad` is true until the very first answer, so pages can show skeletons once
//    and keep stale rows visible (with a thin progress bar) on later refetches.
//  - `reload()` re-runs the request (e.g. after a create/update/delete).
export function useApiList(path, params = {}) {
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState({ key: null, rows: [], error: '' })

  // Drop empty filters, then serialise so the effect only re-runs when values change.
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  const paramKey = JSON.stringify(clean)
  const key = `${path}|${paramKey}|${reloadKey}`

  useEffect(() => {
    const controller = new AbortController()
    api
      .get(path, { params: JSON.parse(paramKey), signal: controller.signal })
      .then((res) => setResult({ key, rows: res.data, error: '' }))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return
        setResult({
          key,
          rows: [],
          error: err.response?.data?.message || 'Could not load data. Is the backend running?',
        })
      })
    return () => controller.abort()
  }, [key, path, paramKey])

  const reload = useCallback(() => setReloadKey((n) => n + 1), [])

  return { rows: result.rows, error: result.error, loading: result.key !== key, firstLoad: result.key === null, reload }
}
