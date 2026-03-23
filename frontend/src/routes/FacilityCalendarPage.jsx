import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import CalendarGrid from '../components/CalendarGrid'
import { getAvailability, getFacility } from '../lib/api'
import { isoToday, overlaps, parseTimeToMinutes } from '../lib/time'

const MAX_BOOKING_MINUTES = 180

function formatDurationLabel(totalMinutes) {
  const m = Number(totalMinutes)
  if (!Number.isFinite(m) || m <= 0) return ''
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  if (r === 0) return h === 1 ? '1 hour' : `${h} hours`
  return `${h} hour ${r} min`
}

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

  const end = useMemo(() => {
    const startMin = parseTimeToMinutes(selectedStart)
    if (startMin === null) return ''
    const endMin = startMin + Number(duration)
    const hh = String(Math.floor(endMin / 60)).padStart(2, '0')
    const mm = String(endMin % 60).padStart(2, '0')
    return `${hh}:${mm}`
  }, [selectedStart, duration])

  const durationOptions = useMemo(() => {
    const startMin = parseTimeToMinutes(selectedStart)
    const max = startMin === null ? MAX_BOOKING_MINUTES : Math.min(MAX_BOOKING_MINUTES, Math.max(30, 24 * 60 - startMin))
    const out = []
    for (let m = 30; m <= max; m += 30) out.push(m)
    return out
  }, [selectedStart])

  useEffect(() => {
    if (!durationOptions.length) return
    const max = durationOptions[durationOptions.length - 1]
    if (!Number.isFinite(duration) || duration < 30) {
      setDuration(60)
      return
    }
    if (duration > max) setDuration(max)
  }, [duration, durationOptions])

  const hasOverlap = useMemo(() => {
    const startMin = parseTimeToMinutes(selectedStart)
    const endMin = parseTimeToMinutes(end)
    if (startMin === null || endMin === null) return false

    return reservations.some((r) => {
      const rStart = parseTimeToMinutes(r.start)
      const rEnd = parseTimeToMinutes(r.end)
      return overlaps(startMin, endMin, rStart, rEnd)
    })
  }, [selectedStart, end, reservations])

  useEffect(() => {
    let ignore = false
    getFacility(id)
      .then((payload) => {
        if (ignore) return
        setFacility(payload)
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [id])

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
      })
      .catch(() => {
        if (ignore) return
        setReservations([])
      })
      .finally(() => {
        if (ignore) return
        setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id, date])

  const proceed = () => {
    // prevent past-date navigation, double-check even though backend also validates
    if (date < isoToday()) {
      alert("You can't book a past date/time. Please choose a future slot.")
      return
    }

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
      <div className="container" style={{ paddingBottom: '200px' }}>
        <div className="stack">
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

          <Link className="btn" to={searchContext ? `/search?${searchContext}` : '/search'} style={{ alignSelf: 'flex-start' }}>
            ← Back to results
          </Link>

          <div className="gridSidebar">
            <aside className="card cardPad">
              <div className="stack" style={{ gap: 12 }}>
                <div className="h2">Booking details</div>

                <div className="field">
                  <div className="label">Date</div>
                  <input className="input" type="date" value={date} min={isoToday()} onChange={(e) => {
                    const selected = e.target.value
                    if (selected < isoToday()) {
                      alert("You can't book a past date/time. Please choose a future slot.")
                      return
                    }
                    setDate(selected)}
                  }
                  />
                  {date < isoToday() && (
                    <div className="alert alertDanger">
                      <div style={{ color: 'var(--danger)', fontSize: 14 }}>
                        ⚠️ You can’t choose a past date.
                      </div>
                    </div>
                  )}
                </div>

                <div className="field">
                  <div className="label">Duration</div>
                  <select className="select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {durationOptions.map((m) => (
                      <option key={m} value={m}>
                        {formatDurationLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="alert">
                  <div className="alertTitle">Selected slot</div>
                  <div className="muted">
                    {date} • {selectedStart}–{end}
                  </div>
                </div>

                {hasOverlap && (
                  <div className="alert alertDanger">
                    <div style={{ color: 'var(--danger)', fontSize: 14 }}>
                      ⚠️ This timeslot overlaps with an existing booking. Please choose a different time or duration.
                    </div>
                  </div>
                )}

                <button
                  className="btn btnPrimary"
                  onClick={proceed}
                  disabled={!selectedStart || !end || isLoading || hasOverlap || date < isoToday()}
                >
                  Continue to confirmation
                </button>

                <div className="muted2" style={{ fontSize: 12 }}>
                  Unavailable slots are disabled to prevent double booking.
                </div>
              </div>
            </aside>

            <section className="card cardPad">
              {isLoading ? (
                <div className="muted">Loading availability…</div>
              ) : (
                <CalendarGrid
                  date={date}
                  reservations={reservations}
                  selectedStart={selectedStart}
                  selectedDuration={duration}
                  onSelectStart={setSelectedStart}
                  businessHours={{ start: '00:00', end: '24:00' }}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
