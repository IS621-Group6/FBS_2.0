import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { createBooking, getFacility } from '../lib/api'

export default function BookingConfirmPage() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const userEmail = 'guest@smu.edu.sg'

  const facilityId = sp.get('facilityId') || ''
  const date = sp.get('date') || ''
  const start = sp.get('start') || ''
  const end = sp.get('end') || ''
  const returnContext = sp.get('return') || ''

  const [facility, setFacility] = useState(null)
  const [ack, setAck] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reasonTrimmed = useMemo(() => reason.trim(), [reason])

  const calendarUrl = useMemo(() => {
    const next = new URLSearchParams()
    if (returnContext) {
      // keep original filters when returning
      for (const [k, v] of new URLSearchParams(returnContext).entries()) next.set(k, v)
    }
    if (date) next.set('date', date)
    if (start) next.set('start', start)
    return `/facility/${encodeURIComponent(facilityId)}/calendar?${next.toString()}`
  }, [facilityId, returnContext, date, start])

  useEffect(() => {
    let ignore = false
    if (!facilityId) return

    getFacility(facilityId)
      .then((payload) => {
        if (ignore) return
        setFacility(payload)
      })
      .catch(() => {
        if (ignore) return
        setFacility(null)
      })

    return () => {
      ignore = true
    }
  }, [facilityId])

  const submit = async () => {
    if (!reasonTrimmed) {
      return
    }

    setIsSubmitting(true)

    try {
      const booking = await createBooking({
        facilityId,
        date,
        start,
        end,
        userEmail,
        reason: reasonTrimmed,
      })
      navigate(`/booking/success?id=${encodeURIComponent(booking.id)}`)
    } catch (e) {
      const next = new URLSearchParams()
      next.set('code', String(e?.status || 500))
      if (e?.message) next.set('message', String(e.message))
      navigate(`/error?${next.toString()}`, { replace: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="containerNarrow">
        <div className="stack">
          <div>
            <h1 className="h1">Confirm booking</h1>
            <div className="muted2">Review details before submitting.</div>
          </div>

          <div className="card cardPad">
            <div className="stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="h2">Booking summary</div>
                  <div className="muted">
                    {facility?.name || `Facility ${facilityId}`}
                  </div>
                </div>
                <span className="pill">{userEmail}</span>
              </div>

              <div className="divider" />

              <div className="grid2">
                <div className="alert">
                  <div className="alertTitle">Date</div>
                  <div className="muted">{date}</div>
                </div>
                <div className="alert">
                  <div className="alertTitle">Time</div>
                  <div className="muted">
                    {start}–{end}
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div className="field">
                <div className="label">Booking reason</div>
                <textarea
                  className="input"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Project meeting, tutoring session, CCA discussion"
                />
                <div className="muted2" style={{ fontSize: 12 }}>
                  Required. This helps admins understand usage.
                </div>
              </div>

              <div className="divider" />

              <label className="row" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span className="muted">
                  I understand the facility policy and will vacate on time.
                </span>
              </label>

              <div className="row" style={{ justifyContent: 'space-between' }}>
                <Link className="btn" to={calendarUrl}>
                  Change time
                </Link>
                <button className="btn btnPrimary" onClick={submit} disabled={!ack || !reasonTrimmed || isSubmitting}>
                  {isSubmitting ? 'Booking…' : 'Confirm booking'}
                </button>
              </div>

              <div className="muted2" style={{ fontSize: 12 }}>
                Confirmation runs a conflict check to prevent double booking.
              </div>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Link className="btn" to={returnContext ? `/search?${returnContext}` : '/search'}>
              Back to results
            </Link>
            <Link className="btn" to="/">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
