import { Link, Navigate, useSearchParams, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Alert from '../components/Alert'
import BookingToast from '../components/BookingToast'
import { useState } from 'react'
import useAuth from '../lib/useAuth'

export default function BookingResultPage({ variant }) {
  const [sp] = useSearchParams()
  const location = useLocation()
  const { user } = useAuth()
  const [toastData, setToastData] = useState(() => {
    if (!(variant === 'success' && location.state?.financial)) return null
    const financial = location.state.financial
    const userRole = user.email === 'guest@smu.edu.sg' || user.email.endsWith('@smu.edu.sg') ? 'student' : 'staff'
    return {
      userRole,
      creditsInfo: financial.deducted !== undefined ? { deducted: financial.deducted, creditsRemaining: financial.creditsRemaining } : null,
      costCentre: financial.costCentre,
    }
  })

  if (variant === 'success') {
    const id = sp.get('id') || ''
    return (
      <AppShell>
        {toastData && (
          <BookingToast
            {...toastData}
            onClose={() => setToastData(null)}
          />
        )}
        <div className="containerNarrow">
          <div className="stack">
            <h1 className="h1">Booking successful</h1>
            <Alert variant="success" title="Confirmed">
              Your booking was created. Booking ID: <strong>{id || '—'}</strong>
            </Alert>
            <div className="card cardPad">
              <div className="stack">
                <div className="h2">Next steps</div>
                <div className="muted">You can now share the booking ID with your group if needed.</div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <Link className="btn" to="/search">
                    Book another room
                  </Link>
                  <Link className="btn btnPrimary" to="/">
                    Back to dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return <Navigate to="/search" replace />
}
