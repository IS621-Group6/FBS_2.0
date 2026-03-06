import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { cancelBooking, getBookings } from '../lib/api'
import useAuth from '../lib/useAuth'

function formatStatus(status) {
  const raw = String(status || 'active').toLowerCase()
  if (raw === 'confirmed') return 'active'
  return raw
}

export default function ViewBookingsPage() {
  const { user } = useAuth()
  const userEmail = user?.email || ''

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCancellingById, setIsCancellingById] = useState({})

  const activeCount = useMemo(() => items.filter((item) => formatStatus(item.status) === 'active').length, [items])

  const loadBookings = async () => {
    if (!userEmail) return
    setIsLoading(true)
    setError('')
    try {
      const payload = await getBookings(userEmail)
      setItems(payload?.items || [])
    } catch (e) {
      setError(e?.message || 'Failed to load bookings')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [userEmail])

  const handleCancel = async (bookingId) => {
    if (!bookingId || !userEmail) return
    setIsCancellingById((prev) => ({ ...prev, [bookingId]: true }))
    try {
      await cancelBooking(bookingId, userEmail)
      await loadBookings()
    } catch (e) {
      alert(e?.message || 'Unable to cancel booking')
    } finally {
      setIsCancellingById((prev) => ({ ...prev, [bookingId]: false }))
    }
  }

  return (
    <AppShell>
      <div className="containerNarrow">
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h1 className="h1">My bookings</h1>
              <div className="muted2">View your current and past booking records.</div>
            </div>
            <Link className="btn" to="/search">
              Book a room
            </Link>
          </div>

          <div className="card cardPad">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="h2">Summary</div>
              <div className="pill">{activeCount} active</div>
            </div>
          </div>

          {isLoading ? <div className="muted">Loading bookings…</div> : null}

          {error ? (
            <div className="alert alertDanger">
              <div className="alertTitle">Could not load bookings</div>
              <div className="muted">{error}</div>
            </div>
          ) : null}

          {!isLoading && !error && items.length === 0 ? (
            <div className="card cardPad">
              <div className="stack">
                <div className="h2">No bookings found</div>
                <div className="muted">You have not created any bookings yet.</div>
                <div>
                  <Link className="btn btnPrimary" to="/search">
                    Find a facility
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {!isLoading && !error && items.length > 0 ? (
            <div className="stack" style={{ gap: 12 }}>
              {items.map((booking) => {
                const status = formatStatus(booking.status)
                const canCancel = status === 'active'
                const plainId = String(booking.id || '').replace(/^B-/, '')
                const isCancelling = Boolean(isCancellingById[plainId])

                return (
                  <div key={booking.id} className="card cardPad">
                    <div className="stack" style={{ gap: 10 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <div>
                          <div className="h2">{booking.facilityName || booking.facilityId || 'Facility'}</div>
                          <div className="muted">Booking ID: {booking.id}</div>
                        </div>
                        <span className="pill">{status}</span>
                      </div>

                      <div className="grid2">
                        <div className="alert">
                          <div className="alertTitle">Date</div>
                          <div className="muted">{booking.date}</div>
                        </div>
                        <div className="alert">
                          <div className="alertTitle">Time</div>
                          <div className="muted">
                            {booking.start}–{booking.end}
                          </div>
                        </div>
                      </div>

                      <div className="muted">Reason: {booking.reason || '—'}</div>

                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <button className="btn" type="button" onClick={loadBookings}>
                          Refresh
                        </button>
                        <button
                          className="btn btnPrimary"
                          type="button"
                          onClick={() => handleCancel(plainId)}
                          disabled={!canCancel || isCancelling}
                        >
                          {isCancelling ? 'Cancelling…' : canCancel ? 'Cancel booking' : 'Not cancellable'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
