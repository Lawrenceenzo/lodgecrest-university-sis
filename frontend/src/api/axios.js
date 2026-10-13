import axios from 'axios'

export const TOKEN_KEY = 'sis_token'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const api = axios.create({ baseURL: API_URL })

// Uploaded files (e.g. "/uploads/<uuid>.png") are served by the API server, not by Vite.
export const assetUrl = (path) => (path ? `${new URL(API_URL).origin}${path}` : '')

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Expired/invalid token on a protected call: drop it and send the user to /login.
// (A failed login attempt is also a 401, so skip the auth endpoints.)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/')
    // The student's portal access was ended (archived / transferred) while signed in.
    if (error.response?.data?.code === 'ACCOUNT_INACTIVE' && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.assign('/login?notice=inactive')
    }
    // The server refuses everything except changing a temporary password: send the user there.
    if (error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED' && window.location.pathname !== '/change-password') {
      window.location.assign('/change-password')
    }
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export default api
