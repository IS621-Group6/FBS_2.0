import { useEffect, useMemo, useState } from 'react'
import './LoginPage.css'

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
  const [lockoutUntil, setLockoutUntil] = useState(null)
  const [now, setNow] = useState(Date.now())
 
  const remainingSeconds = lockoutUntil
  ? Math.max(0, Math.ceil((lockoutUntil - now) / 1000))
  : 0

  const isLocked = remainingSeconds > 0

  const lockoutMessage = useMemo(() => {
    if (!isLocked) return ''
    const remainingMinutes = Math.ceil(remainingSeconds / 60)
    return `Account locked after too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`
  }, [isLocked, remainingSeconds])

  useEffect(() => {
    if (!isLocked) return
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [isLocked])

  const handleSubmit = async (e) => {
  e.preventDefault()

  if (isLocked) {
    setError(lockoutMessage)
    return
  }

  setError('')
  setIsLoading(true)

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      if (response.status === 429 && data.error === 'LOGIN_LOCKED') {
        const retryAfterSeconds = Number(data.retryAfterSeconds) || 15 * 60
        setLockoutUntil(Date.now() + retryAfterSeconds * 1000)
        setNow(Date.now())
        setError(
          data.message ||
            'Account locked after too many failed attempts. Please try again in 15 minutes.'
        )
        return
      }

      setError(data.message || 'Invalid email or password.')
      return
    }

    if (data.token) {
      localStorage.setItem('fbs_token', data.token)
    }

    setLockoutUntil(null)
    onLoginSuccess({ email: data.email })
  } catch (err) {
    setError('Unable to reach server. Please try again.')
  } finally {
    setIsLoading(false)
  }
}

  const handleForgotPassword = (e) => {
    e.preventDefault()
    // TODO: Implement password reset flow
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Facility Booking System</h1>
          <p className="login-subtitle">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-field">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@smu.edu.sg"
              required
              disabled={isLoading || isLocked}
              aria-invalid={error ? 'true' : 'false'}
            />
          </div>

          <div className="form-field">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading || isLocked}
                aria-invalid={error ? 'true' : 'false'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {(error || isLocked) && (
            <div className={`error-message ${isLocked ? 'locked-message' : ''}`} role="alert">
              {isLocked ? lockoutMessage : error}
            </div>
          )}

          <button type="submit" disabled={isLoading || isLocked} className="form-button">
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="forgot-password">
          <a href="#" onClick={handleForgotPassword} className="forgot-password-link">Forgot password?</a>
        </div>

        <div className="test-credentials">
          <p className="test-credentials-label">Test Credentials:</p>
          <p className="test-credentials-text">Email: demo@smu.edu.sg</p>
          <p className="test-credentials-text">Password: demo123</p>
        </div>
      </div>
    </div>
  )
}
