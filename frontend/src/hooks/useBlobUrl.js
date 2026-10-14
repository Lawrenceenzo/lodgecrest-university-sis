import { useEffect, useState } from 'react'
import api from '../api/axios'

// Loads a file that only the signed-in user may read (the request carries the login token), and gives it back as
// a temporary address an <img> can show. The address is released when the component goes away.
export function useBlobUrl(path) {
  const [result, setResult] = useState({ path: null, url: '', error: '' })

  useEffect(() => {
    if (!path) return undefined
    const controller = new AbortController()
    let made = ''
    api
      .get(path, { responseType: 'blob', signal: controller.signal })
      .then((res) => {
        made = URL.createObjectURL(res.data)
        setResult({ path, url: made, error: '' })
      })
      .catch((err) => {
        if (err.code !== 'ERR_CANCELED') setResult({ path, url: '', error: 'The image could not be loaded.' })
      })
    return () => {
      controller.abort()
      if (made) URL.revokeObjectURL(made)
    }
  }, [path])

  const current = result.path === path
  return { url: current ? result.url : '', error: current ? result.error : '', loading: Boolean(path) && !current }
}
