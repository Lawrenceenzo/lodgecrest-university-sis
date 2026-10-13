// Works out the API address from VITE_API_URL. Vite bakes that value into the bundle when it BUILDS, so on
// Vercel it must be set in the project's Environment Variables before the build (and redeployed after a change).
//
// The value may be given with or without the trailing "/api": both end up as ".../api", so
//   VITE_API_URL=https://lodgecrest-university-sis.onrender.com        and
//   VITE_API_URL=https://lodgecrest-university-sis.onrender.com/api    behave the same.

export const DEV_API_URL = 'http://localhost:5001/api'
// Safety net for a production build that was made without VITE_API_URL: the live backend, not localhost
// (localhost would be the visitor's own computer). Remove this if you ever move the backend.
export const PRODUCTION_FALLBACK_API_URL = 'https://lodgecrest-university-sis.onrender.com/api'

export function resolveApiUrl(raw, isProduction) {
  const value = String(raw ?? '').trim().replace(/\/+$/, '')
  if (!value) return isProduction ? PRODUCTION_FALLBACK_API_URL : DEV_API_URL
  return /\/api$/i.test(value) ? value : `${value}/api`
}
