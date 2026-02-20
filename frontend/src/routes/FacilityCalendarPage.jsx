import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Alert from '../components/Alert'
import CalendarGrid from '../components/CalendarGrid'
import { getAvailability, getFacility } from '../lib/api'
import { isoToday, parseTimeToMinutes } from '../lib/time'

export default function FacilityCalendarPage() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const navigate = useNavigate()

  const searchContext = useMemo(() => {
    const next = new URLSearchParams(sp)
    next.delete('page')
    return next.toString()
  }, [sp])

  const initialDate = sp.get('date') || isoToday()
  const initialStart = sp.get('start') || '10:00'

  const [facility, setFacility] = useState(null)
  const [date, setDate] = useState(initialDate)
  const [selectedStart, setSelectedStart] = useState(initialStart)
  const [duration, setDuration] = useState(Number(sp.get('duration') || '60'))
  const [reservations, setReservations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const end = useMemo(() => {
    const startMin = parseTimeToMinutes(selectedStart)
    if (startMin === null) return ''
    const endMin = startMin + Number(duration)
    const hh = String(Math.floor(endMin / 60)).padStart(2, '0')
    const mm = String(endMin % 60).padStart(2, '0')
    return `${hh}:${mm}`
  }, [selectedStart, duration])

  useEffect(() => {
    let ignore = false
    getFacility(id)
      .then((payload) => {
        if (ignore) return
        setFacility(payload)
        setError(null)
      })
      .catch((err) => {
        if (ignore) return
        setFacility(null)
        setError({
          code: err?.status || 500,
          message: err?.message || 'Failed to load facility.',
        })
      })

    return () => {
      ignore = true
    }
  }, [id, navigate])

  useEffect(() => {
    let ignore = false
    Promise.resolve().then(() => {
      if (ignore) return
      setIsLoading(true)
    })
    getAvailability(id, date)
      .then((payload) => {
        if (ignore) return
        setReservations(payload.reservations || [])
        setError(null)
      })
      .catch((err) => {
        if (ignore) return
        setReservations([])
        setError({
          code: err?.status || 500,
          message: err?.message || 'Failed to load availability.',
        })
      })
      .finally(() => {
        if (ignore) return
        setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id, date, navigate])

  const proceed = () => {
    const confirmSp = new URLSearchParams()
    confirmSp.set('facilityId', id)
    confirmSp.set('date', date)
    confirmSp.set('start', selectedStart)
    confirmSp.set('end', end)
    if (searchContext) confirmSp.set('return', searchContext)
    navigate(`/booking/confirm?${confirmSp.toString()}`)
  }

  return (
    <AppShell>
      <div className="container">
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h1 className="h1">Availability</h1>
              <div className="muted">
                {facility ? (
                  <>
                    {facility.name} • {facility.campus}
                  </>
                ) : (
                  'Loading facility…'
                )}
              </div>
            </div>
            <Link className="btn" to={searchContext ? `/search?${searchContext}` : '/search'}>
              Back to results
            </Link>
          </div>

          <div className="gridSidebar">
            <aside className="card cardPad">
              <div className="stack" style={{ gap: 12 }}>
                <div className="h2">Booking details</div>

                <div className="field">
                  <div className="label">Date</div>
                  <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <div className="field">
                  <div className="label">Duration</div>
                  <select className="select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    <option value={60}>1 hour</option>
                    <option value={90}>1 hour 30 min</option>
                    <option value={120}>2 hours</option>
                    <option value={150}>2 hours 30 min</option>
                    <option value={180}>3 hours</option>
                  </select>
                </div>

                <div className="alert">
                  <div className="alertTitle">Selected slot</div>
                  <div className="muted">
                    {date} • {selectedStart}–{end}
                  </div>
                </div>

                <button className="btn btnPrimary" onClick={proceed} disabled={!selectedStart || !end || isLoading}>
                  Continue to confirmation
                </button>

                <div className="muted2" style={{ fontSize: 12 }}>
                  Unavailable slots are disabled to prevent double booking.
                </div>
              </div>
            </aside>

            <section className="card cardPad">
              {error ? (
                <div className="stack">
                  <div className="h2">Unable to load</div>
                  <Alert variant="danger" title={`Error ${error.code}`}>{error.message}</Alert>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <Link className="btn" to={searchContext ? `/search?${searchContext}` : '/search'}>
                      Back to results
                    </Link>
                    <button className="btn btnPrimary" onClick={() => window.location.reload()}>
                      Reload
                    </button>
                  </div>
                </div>
              ) : isLoading ? (
                <div className="muted">Loading availability…</div>
              ) : (
                <CalendarGrid
                  date={date}
                  reservations={reservations}
                  selectedStart={selectedStart}
                  selectedDuration={duration}
                  onSelectStart={setSelectedStart}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
