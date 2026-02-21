import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import FacilityCard from '../components/FacilityCard'
import Pagination from '../components/Pagination'
import { getAvailabilityGlimpse, searchFacilities } from '../lib/api'
import { isoToday, parseTimeToMinutes } from '../lib/time'

const CAMPUSES = ['Main Campus', 'Downtown Campus', 'Law Campus', 'Innovation District']
const EQUIPMENT = ['Projector', 'Whiteboard', 'Video Conferencing', 'Microphone', 'PC Lab']

function readEquipment(sp) {
  const raw = sp.get('equipment') || ''
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function SearchPage() {
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()

  const q = sp.get('q') || ''
  const campus = sp.get('campus') || ''
  const minCapacity = sp.get('minCapacity') || ''
  const date = sp.get('date') || isoToday()
  const start = sp.get('start') || '10:00'
  const duration = Number(sp.get('duration') || '60')
  const end = useMemo(() => {
    const startMin = parseTimeToMinutes(start)
    if (startMin === null) return '11:00'
    const endMin = startMin + Number(duration)
    const hh = String(Math.floor(endMin / 60)).padStart(2, '0')
    const mm = String(endMin % 60).padStart(2, '0')
    return `${hh}:${mm}`
  }, [start, duration])
  const equipment = readEquipment(sp)
  const equipmentKey = useMemo(() => equipment.join(','), [equipment])
  const page = Math.max(1, Number(sp.get('page') || '1'))

  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const [glimpsesById, setGlimpsesById] = useState({})

  const searchContext = useMemo(() => {
    const next = new URLSearchParams(sp)
    next.delete('page')
    next.delete('facilityId')
    next.delete('slot')
    next.delete('end')
    return next.toString()
  }, [sp])

  const resultIdsKey = useMemo(() => {
    const ids = data?.items?.map((x) => x.id) || []
    return ids.join(',')
  }, [data])

  const resultIds = useMemo(() => {
    return (data?.items || []).map((x) => x.id)
  }, [data])

  useEffect(() => {
    let ignore = false
    Promise.resolve().then(() => {
      if (ignore) return
      setIsLoading(true)
    })

    searchFacilities({
      q,
      campus,
      minCapacity,
      equipment: equipmentKey ? equipmentKey.split(',').filter(Boolean) : [],
      date,
      start,
      end,
      page,
      pageSize: 12,
    })
      .then((payload) => {
        if (ignore) return
        setData(payload)
      })
      .catch(() => {
        if (ignore) return
        setData(null)
      })
      .finally(() => {
        if (ignore) return
        setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [q, campus, minCapacity, equipmentKey, date, start, end, page])

  useEffect(() => {
    let ignore = false
    const ids = resultIds
    if (!ids.length) {
      Promise.resolve().then(() => {
        if (ignore) return
        setGlimpsesById({})
      })
      return () => {
        ignore = true
      }
    }

    Promise.resolve().then(() => {
      if (ignore) return
      const loading = {}
      for (const id of ids) loading[id] = { status: 'loading' }
      setGlimpsesById(loading)
    })

    // Card previews are intentionally hour-by-hour blobs, independent of the booking duration.
    getAvailabilityGlimpse({ ids, date, start, duration: 60, limit: 3 })
      .then((payload) => {
        if (ignore) return
        const next = {}
        for (const id of ids) {
          next[id] = payload?.items?.[id] || null
        }
        setGlimpsesById(next)
      })
      .catch(() => {
        if (ignore) return
        // If glimpse fails, keep UI functional; just omit previews.
        setGlimpsesById({})
      })

    return () => {
      ignore = true
    }
  }, [resultIdsKey, resultIds, date, start])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(sp)
    if (!value) next.delete(key)
    else next.set(key, value)
    next.set('page', '1')
    setSp(next)
  }

  const updateMany = (updates) => {
    const next = new URLSearchParams(sp)
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === '') next.delete(key)
      else next.set(key, String(value))
    }
    next.set('page', '1')
    setSp(next)
  }

  const toggleEquipment = (eq) => {
    const set = new Set(equipment)
    if (set.has(eq)) set.delete(eq)
    else set.add(eq)
    const next = new URLSearchParams(sp)
    const arr = Array.from(set)
    if (arr.length) next.set('equipment', arr.join(','))
    else next.delete('equipment')
    next.set('page', '1')
    setSp(next)
  }

  const onPageChange = (nextPage) => {
    const next = new URLSearchParams(sp)
    next.set('page', String(nextPage))
    setSp(next)
  }

  const clearFilters = () => {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    next.set('date', isoToday())
    next.set('start', '10:00')
    next.set('duration', '60')
    next.set('page', '1')
    navigate(`/?${next.toString()}`)
  }

  const goToCalendar = (facilityId) => {
    const next = new URLSearchParams(sp)
    next.delete('page')
    next.delete('facilityId')
    next.delete('slot')
    next.delete('end')
    if (date) next.set('date', date)
    if (start) next.set('start', start)
    if (duration) next.set('duration', String(duration))
    navigate(`/facility/${encodeURIComponent(facilityId)}/calendar?${next.toString()}`)
  }

  return (
    <AppShell>
      <div className="container">
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h1 className="h1">Search, filter, and book</h1>
              <div className="muted2">Search-first booking for thousands of rooms.</div>
            </div>
            <button className="btn" onClick={clearFilters}>
              Reset filters
            </button>
          </div>

          <div className="card cardPad">
            <div className="stack" style={{ gap: 12 }}>
              <div className="filterBar" aria-label="Search and filters">
                <div className="field filterItem">
                  <div className="label">Keyword</div>
                  <input
                    className="input"
                    value={q}
                    onChange={(e) => updateParam('q', e.target.value)}
                    placeholder="e.g., seminar, LKS, projector"
                  />
                </div>

                <div className="field filterItemSm">
                  <div className="label">Campus</div>
                  <select className="select" value={campus} onChange={(e) => updateParam('campus', e.target.value)}>
                    <option value="">Any</option>
                    {CAMPUSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field filterItemSm">
                  <div className="label">Min capacity</div>
                  <input
                    className="input"
                    value={minCapacity}
                    inputMode="numeric"
                    placeholder="e.g., 12"
                    onChange={(e) => updateParam('minCapacity', e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>

                <div className="field filterItemSm">
                  <div className="label">Date</div>
                  <input className="input" type="date" value={date} onChange={(e) => updateParam('date', e.target.value)} />
                </div>

                <div className="field filterItemSm">
                  <div className="label">Start</div>
                  <input className="input" type="time" value={start} onChange={(e) => updateParam('start', e.target.value)} />
                </div>

                <div className="field filterItemSm">
                  <div className="label">Duration</div>
                  <select className="select" value={duration} onChange={(e) => updateParam('duration', e.target.value)}>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                    <option value="150">2.5 hours</option>
                    <option value="180">3 hours</option>
                  </select>
                </div>

                <div className="field" style={{ minWidth: 220, flex: 2 }}>
                  <div className="label">Equipment</div>
                  <div className="row">
                    {EQUIPMENT.map((eq) => (
                      <label key={eq} className="pill" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={equipment.includes(eq)} onChange={() => toggleEquipment(eq)} />
                        {eq}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="row" style={{ gap: 10 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      // normalize derived end time in URL for shareable state
                      updateMany({ end })
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="muted2" style={{ fontSize: 12 }}>
                Filters update results; select a room to book from the same page.
              </div>
            </div>
          </div>

          <div className="alert">
            <div className="alertTitle">Next step</div>
            <div className="muted">Select a room below to open its calendar and book it.</div>
          </div>

          {isLoading ? (
            <div className="card cardPad">Loading…</div>
          ) : data?.items?.length ? (
            <>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="pill">
                  {data.total} rooms • Showing {data.items.length} (page {data.page})
                </span>
                <span className="pill">Sorted: relevance</span>
              </div>

              <div className="resultsList">
                {data.items.map((f) => (
                  <FacilityCard
                    key={f.id}
                    facility={f}
                    searchContext={searchContext}
                    onSelect={() => goToCalendar(f.id)}
                    availabilityGlimpse={glimpsesById[f.id]}
                  />
                ))}
              </div>

              <Pagination page={data.page} pageCount={data.pageCount} onPageChange={onPageChange} />
            </>
          ) : (
            <div className="card cardPad">
              <div className="h2">No matching rooms</div>
              <div className="muted">
                Try a different keyword, reduce equipment requirements, or lower min capacity.
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
