import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { getFacility } from '../lib/api'

export default function FacilityDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const searchContext = useMemo(() => {
    const next = new URLSearchParams(sp)
    next.delete('page')
    return next.toString()
  }, [sp])

  const [facility, setFacility] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    Promise.resolve().then(() => {
      if (ignore) return
      setIsLoading(true)
    })
    getFacility(id)
      .then((payload) => {
        if (ignore) return
        setFacility(payload)
      })
      .catch(() => {
        if (ignore) return
        navigate(searchContext ? `/search?${searchContext}` : '/search', { replace: true })
      })
      .finally(() => {
        if (ignore) return
        setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id, navigate, searchContext])

  const calendarUrl = `/facility/${encodeURIComponent(id)}/calendar${searchContext ? `?${searchContext}` : ''}`

  return (
    <AppShell>
      <div className="container">
        {isLoading ? (
          <div className="card cardPad">Loading…</div>
        ) : facility ? (
          <div className="facilityDetailSplit">
            <div className="facilityHero" aria-label="Facility photo">
              <img src="/room-placeholder.svg" alt="Facility" loading="lazy" />
            </div>

            <div className="facilityDetailBottom">
              <div className="card cardPad">
                <div className="stack" style={{ gap: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h1 className="h1">{facility.name}</h1>
                      <div className="muted">
                        {facility.campus} • {facility.building} • Capacity {facility.capacity}
                      </div>
                    </div>
                    <Link className="btn btnPrimary" to={calendarUrl}>
                      Check availability
                    </Link>
                  </div>

                  <div className="muted">
                    View facility details and book a time slot.
                  </div>
                </div>
              </div>

              <div className="facilityDetailGrid">
                <section className="stack" style={{ gap: 16 }}>
                  <div className="card cardPad">
                    <div className="stack">
                      <div className="h2">Room details</div>
                      <div className="muted2" style={{ fontSize: 12 }}>
                        Equipment, policies, and location.
                      </div>

                      <div className="divider" />

                      <div className="h2">Equipment</div>
                      <div className="row">
                        {(facility.equipment || []).map((eq) => (
                          <span key={eq} className="chip">
                            {eq}
                          </span>
                        ))}
                      </div>

                      <div className="divider" />

                      <div className="h2">Policies</div>
                      <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                        <li>Arrive on time; unused bookings may be released.</li>
                        <li>Keep the room clean and return furniture to original layout.</li>
                        <li>Do not exceed capacity; comply with campus safety rules.</li>
                      </ul>

                      <div className="divider" />

                      <div className="h2">Location</div>
                      <div className="muted">
                        {facility.campus} — {facility.building}
                      </div>
                      <div className="muted2" style={{ fontSize: 12, marginTop: 6 }}>
                        Map integration can be added later.
                      </div>
                    </div>
                  </div>
                </section>

                <aside className="stack" style={{ gap: 16 }}>
                  <div className="card cardPad">
                    <div className="stack">
                      <div className="h2">Quick info</div>
                      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="alert">
                          <div className="alertTitle">Room ID</div>
                          <div className="muted">{facility.id}</div>
                        </div>
                        <div className="alert">
                          <div className="alertTitle">Capacity</div>
                          <div className="muted">{facility.capacity}</div>
                        </div>
                        <div className="alert">
                          <div className="alertTitle">Campus</div>
                          <div className="muted">{facility.campus}</div>
                        </div>
                        <div className="alert">
                          <div className="alertTitle">Building</div>
                          <div className="muted">{facility.building}</div>
                        </div>
                      </div>

                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <Link className="btn" to={searchContext ? `/search?${searchContext}` : '/search'}>
                          Back to results
                        </Link>
                        <Link className="btn btnPrimary" to={calendarUrl}>
                          Continue
                        </Link>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
