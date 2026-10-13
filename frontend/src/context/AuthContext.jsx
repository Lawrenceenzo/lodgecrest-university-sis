import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { TOKEN_KEY } from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // True while we check a stored token on first load, so routes don't flash /login.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch((err) => {
        // Only discard the token if the server rejected it, not on a network error.
        if (err.response?.status === 401) localStorage.removeItem(TOKEN_KEY)
        if (err.response?.data?.code === 'ACCOUNT_INACTIVE') {
          localStorage.removeItem(TOKEN_KEY)
          window.location.replace('/login?notice=inactive')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Step 1: check the password; the server emails a 6-digit code (no token yet).
  const requestOtp = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    return data // { message, email, expiresInSeconds, resendAfterSeconds }
  }, [])

  // Step 2: exchange the code for a token and sign in.
  const verifyOtp = useCallback(async (email, otp) => {
    const { data } = await api.post('/auth/verify-otp', { email, otp })
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    return data.user
  }, [])

  // Changes the password; the server answers with a fresh token because all older ones stop working.
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword })
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, requestOtp, verifyOtp, changePassword, logout }),
    [user, loading, requestOtp, verifyOtp, changePassword, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
