import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import Logo from '../components/Logo'
import ToastSnackbar from '../components/ToastSnackbar'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import { BRAND } from '../config/brand'
import { useAuth } from '../context/AuthContext'
import { passwordProblem } from '../utils/password'
import { destinationFor } from '../utils/roles'

const maskEmail = (email) => {
  const [local, domain] = email.split('@')
  return `${local[0]}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`
}

// The eye button at the end of a password field.
function ShowHide({ shown, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      className="grid size-8 place-items-center rounded text-slate-500 hover:bg-navy-50 hover:text-navy-900 [&_svg]:size-5"
    >
      {shown ? <VisibilityOff /> : <Visibility />}
    </button>
  )
}

const NETWORK_ERROR = 'Unable to reach the server. Is the backend running on port 5001?'

export default function Login() {
  const { requestOtp, verifyOtp, requestPasswordReset, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const requestedPath = location.state?.from?.pathname

  // 'credentials' -> 'otp' is the normal sign-in. 'forgot' (ask for a reset code) -> 'reset' (code + new password) is recovery.
  const [step, setStep] = useState('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  // Shown when an open session was ended because the student's portal access was deactivated.
  const [info, setInfo] = useState(() =>
    new URLSearchParams(location.search).get('notice') === 'inactive' ? 'Your portal access is no longer active. Please contact the Registrar.' : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0) // seconds until "Resend Code" is allowed again
  // Password recovery
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [toast, setToast] = useState(null)
  const [justReset, setJustReset] = useState(false) // after a successful reset: focus the password field

  // Count the resend cooldown down once per second.
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Step 1: email + password -> the server emails a code.
  const handleCredentials = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('') // drop any earlier notice so only the current result is shown
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setSubmitting(true)
    try {
      const data = await requestOtp(email.trim(), password)
      setCooldown(data.resendAfterSeconds ?? 30)
      setInfo('')
      setOtp('')
      setStep('otp')
    } catch (err) {
      // 429 = a code was emailed moments ago and is still valid, so carry on to step 2.
      if (err.response?.status === 429 && err.response.data?.retryAfter) {
        setCooldown(err.response.data.retryAfter)
        setInfo('A code was already sent to your email. Enter it below.')
        setOtp('')
        setStep('otp')
      } else {
        setError(err.response?.data?.message || NETWORK_ERROR)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Step 2: the 6-digit code -> signed in.
  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setSubmitting(true)
    try {
      const signedIn = await verifyOtp(email.trim(), otp)
      navigate(destinationFor(signedIn, requestedPath), { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || NETWORK_ERROR)
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setInfo('')
    setResending(true)
    try {
      const data = await requestOtp(email.trim(), password)
      setCooldown(data.resendAfterSeconds ?? 30)
      setOtp('')
      setInfo('A new code has been sent to your email.')
    } catch (err) {
      if (err.response?.status === 429 && err.response.data?.retryAfter) setCooldown(err.response.data.retryAfter)
      setError(err.response?.data?.message || NETWORK_ERROR)
    } finally {
      setResending(false)
    }
  }

  const backToCredentials = () => {
    setStep('credentials')
    setPassword('') // don't keep the password around once the user leaves step 2
    setOtp('')
    setError('')
    setInfo('')
    setCooldown(0)
  }

  // ---- Forgot password ----------------------------------------------------------------------

  const openForgot = () => {
    setStep('forgot')
    setPassword('')
    setError('')
    setInfo('')
    setFieldErrors({})
  }

  // View A: the email -> the server sends a reset code. It answers the same for every address, so the
  // message says "if", never "we sent".
  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    const address = email.trim()
    if (!address) {
      setError('Enter the email you sign in with.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError('Enter a valid email address.')
      return
    }
    setSubmitting(true)
    try {
      const data = await requestPasswordReset(address)
      setCooldown(data.resendAfterSeconds ?? 30)
      setOtp('')
      setNewPassword('')
      setConfirmPassword('')
      setFieldErrors({})
      setInfo('If that email belongs to an account, we sent a 6-digit code to it. Enter the code and choose a new password.')
      setStep('reset')
    } catch (err) {
      setError(err.response?.data?.message || NETWORK_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  // View B: code + new password (+ confirmation) -> the password is changed.
  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    const errors = {}
    if (!/^\d{6}$/.test(otp)) errors.otp = 'Enter the 6-digit code from your email'
    if (!newPassword) errors.newPassword = 'Enter a new password'
    else if (passwordProblem(newPassword)) errors.newPassword = passwordProblem(newPassword)
    if (!confirmPassword) errors.confirmPassword = 'Re-enter the new password'
    else if (confirmPassword !== newPassword) errors.confirmPassword = 'The passwords do not match'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      await resetPassword(email.trim(), otp, newPassword)
      // Back to the normal sign-in, email filled in, so the user can sign in with the new password right away.
      setStep('credentials')
      setPassword('')
      setOtp('')
      setNewPassword('')
      setConfirmPassword('')
      setCooldown(0)
      setJustReset(true)
      setToast({ severity: 'success', message: 'Password updated. Sign in with your new password.' })
    } catch (err) {
      const errors = err.response?.data?.errors
      setError(errors?.length ? errors.join('. ') : err.response?.data?.message || NETWORK_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendReset = async () => {
    setError('')
    setInfo('')
    setResending(true)
    try {
      const data = await requestPasswordReset(email.trim())
      setCooldown(data.resendAfterSeconds ?? 30)
      setOtp('')
      setInfo('If that email belongs to an account, a new code was sent.')
    } catch (err) {
      setError(err.response?.data?.message || NETWORK_ERROR)
    } finally {
      setResending(false)
    }
  }

  const backToSignIn = () => {
    setStep('credentials')
    setPassword('')
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setFieldErrors({})
    setError('')
    setInfo('')
    setCooldown(0)
  }

  const inCredentials = step === 'credentials'
  const inOtp = step === 'otp'
  const inForgot = step === 'forgot'
  const inReset = step === 'reset'

  const heading = {
    credentials: ['Sign in', 'Welcome back', `Sign in to the ${BRAND.name} ${BRAND.system}.`],
    otp: ['Verification', 'Check your email', `We sent a 6-digit code to ${maskEmail(email.trim())}. It expires in 5 minutes.`],
    forgot: ['Account recovery', 'Forgot your password?', 'Enter the email you sign in with and we will send you a 6-digit code to reset it.'],
    reset: ['Account recovery', 'Choose a new password', `Enter the 6-digit code sent to ${maskEmail(email.trim())} (valid for 5 minutes) and your new password.`],
  }[step]
  const onSubmit = { credentials: handleCredentials, otp: handleVerify, forgot: handleForgot, reset: handleReset }[step]

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Brand panel */}
      <aside className="relative flex flex-col items-center justify-center gap-10 overflow-hidden bg-gradient-to-b from-navy-900 to-navy-950 px-6 py-12 text-white md:basis-[45%] md:py-0 after:absolute after:top-0 after:-right-14 after:hidden after:h-full after:w-28 after:-skew-x-12 after:bg-gold-500 after:content-[''] md:after:block">
        <Logo layout="stack" size={96} />
        <p className="text-center font-serif text-3xl italic leading-tight md:text-4xl">
          {BRAND.tagline.map((word, i) => (
            <span key={word} className={`block ${i === BRAND.tagline.length - 1 ? 'text-gold-500' : ''}`}>
              {word}
            </span>
          ))}
        </p>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70 md:absolute md:bottom-4 md:left-6">{BRAND.system}</p>
      </aside>

      {/* Form panel */}
      <main className="grid flex-1 place-items-center bg-navy-50 p-6">
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex w-full max-w-md flex-col gap-5 rounded-md border border-navy-100 bg-white p-8 shadow-lg shadow-navy-900/10"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-700">{heading[0]}</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-navy-900">{heading[1]}</h1>
            <p className="mt-1 text-sm text-muted">{heading[2]}</p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}
          {info && <Alert tone="info">{info}</Alert>}

          {inCredentials && (
            <>
              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                autoFocus={!justReset}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                startIcon={<PersonOutlined />}
                placeholder="you@lodgecrest.edu"
              />
              <div className="flex flex-col gap-1.5">
                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus={justReset}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  startIcon={<LockOutlined />}
                  endAdornment={<ShowHide shown={showPassword} onToggle={() => setShowPassword((v) => !v)} label="password" />}
                />
                <button
                  type="button"
                  onClick={openForgot}
                  className="self-end rounded text-sm font-medium text-navy-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" loading={submitting} className="w-full py-3">
                Sign in
              </Button>
            </>
          )}

          {inOtp && (
            <>
              <TextField
                label="6-digit code"
                autoFocus
                value={otp}
                // No maxLength attribute: the browser would cut a pasted "690 451" to 6 characters before this
                // filter removes the space, losing a digit. Filtering here keeps all six.
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                inputMode="numeric"
                aria-label="6-digit verification code"
                inputClassName="text-center font-serif !text-2xl font-bold tracking-[0.6em]"
              />
              <Button type="submit" loading={submitting} disabled={otp.length !== 6} className="w-full py-3">
                Verify &amp; Sign in
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted">Didn&apos;t get the code?</p>
                <Button variant="link" onClick={handleResend} disabled={cooldown > 0 || resending || submitting}>
                  {resending ? 'Sending…' : cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
                </Button>
              </div>

              <Button variant="link" onClick={backToCredentials} className="self-center text-sm font-normal">
                Use a different account
              </Button>
            </>
          )}

          {inForgot && (
            <>
              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                startIcon={<PersonOutlined />}
                placeholder="you@lodgecrest.edu"
              />
              <Button type="submit" loading={submitting} className="w-full py-3">
                Send reset code
              </Button>
              <Button variant="link" onClick={backToSignIn} className="self-center text-sm font-normal">
                Back to sign in
              </Button>
            </>
          )}

          {inReset && (
            <>
              <TextField
                label="6-digit code"
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                inputMode="numeric"
                aria-label="6-digit reset code"
                error={fieldErrors.otp}
                inputClassName="text-center font-serif !text-2xl font-bold tracking-[0.6em]"
              />
              <TextField
                label="New password"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                startIcon={<LockOutlined />}
                error={fieldErrors.newPassword}
                endAdornment={<ShowHide shown={showNew} onToggle={() => setShowNew((v) => !v)} label="new password" />}
              />
              <p className="-mt-3 text-xs text-muted">At least 8 characters, with a letter and a number.</p>
              <TextField
                label="Confirm new password"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                startIcon={<LockOutlined />}
                error={fieldErrors.confirmPassword}
              />
              <Button type="submit" loading={submitting} className="w-full py-3">
                Reset password
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted">Didn&apos;t get the code?</p>
                <Button variant="link" onClick={handleResendReset} disabled={cooldown > 0 || resending || submitting}>
                  {resending ? 'Sending…' : cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
                </Button>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button variant="link" onClick={openForgot} className="text-sm font-normal">
                  Use a different email
                </Button>
                <Button variant="link" onClick={backToSignIn} className="text-sm font-normal">
                  Back to sign in
                </Button>
              </div>
            </>
          )}

          <p className="border-t border-navy-100 pt-4 text-center text-xs text-muted">
            <span className="block font-serif text-sm font-semibold tracking-wide text-navy-900">{BRAND.name}</span>
            {BRAND.system}
          </p>
        </form>
      </main>
      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
