import { Link, Navigate, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Alert from '../components/Alert'

export default function BookingResultPage({ variant }) {
  const [sp] = useSearchParams()

  if (variant === 'success') {
    const id = sp.get('id') || ''
    return (
      <AppShell>
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
