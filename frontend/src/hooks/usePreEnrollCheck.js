import { useEffect, useState } from 'react'
import api from '../api/axios'

// Ask the server (without saving anything) whether this set of classes is allowed, after a short pause
// so it is not called on every click. `check` is null until the answer for the CURRENT selection arrives.
export function usePreEnrollCheck(offeringIds) {
  const key = offeringIds.join(',')
  const [result, setResult] = useState({ key: null, data: null, failed: false })

  useEffect(() => {
    if (!key) return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api
        .post('/portal/pre-enrollment/validate', { offeringIds: key.split(',') }, { signal: controller.signal })
        .then((res) => setResult({ key, data: res.data, failed: false }))
        .catch((err) => {
          if (err.code !== 'ERR_CANCELED') setResult({ key, data: null, failed: true })
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key])

  const current = result.key === key
  return { check: current ? result.data : null, checking: key !== '' && !current, failed: current && result.failed }
}
