import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import FacilityCard from '../components/FacilityCard'
import Pagination from '../components/Pagination'
import { getAvailabilityGlimpse, getFilters, searchFacilities } from '../lib/api'
import { isoToday, parseTimeToMinutes } from '../lib/time'

const CAPACITY_RANGE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '0-5', label: '0–5' },
  { value: '6-10', label: '6–10' },
  { value: '11-20', label: '11–20' },
  { value: '21-40', label: '21–40' },
  { value: '41-60', label: '41–60' },
  { value: '61-80', label: '61–80' },
  { value: '81-100', label: '81–100' },
  { value: '100+', label: '100+' },
]


const START_TIME_OPTIONS = (() => {
  const out = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return out
})()

const END_TIME_OPTIONS = [...START_TIME_OPTIONS, '24:00']

const RESULTS_PAGE_SIZE = 48
const CLIENT_MERGE_PAGE_SIZE = 500
const DOCK_TOP_OFFSET_PX = 88
const DOCK_HYSTERESIS_PX = 28
const UNDOCK_AT_TOP_ONLY_PX = 0

function readMulti(sp, key) {
  const raw = sp.get(key) || ''
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function clampBookingDuration(minutes) {
  const m = Number(minutes) || 0
  if (!Number.isFinite(m) || m <= 0) return 60
  return Math.max(30, Math.min(24 * 60, m))
}

function mergeFacilityPayloads(primary, secondary, page, pageSize) {
  const merged = []
  const seen = new Set()

  for (const item of primary?.items || []) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }

  for (const item of secondary?.items || []) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }

  const total = merged.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * pageSize
  const end = start + pageSize

  return {
    items: merged.slice(start, end),
    total,
    page: safePage,
    pageSize,
    pageCount,
  }
}

export default function SearchPage() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const filterTopRef = useRef(null)
  const [dockThresholdY, setDockThresholdY] = useState(null)
  const [isDocked, setIsDocked] = useState(false)

  const pendingScrollRestoreYRef = useRef(null)

  const [filterMeta, setFilterMeta] = useState(null)
  const [filterMetaError, setFilterMetaError] = useState(false)

  const q = sp.get('q') || ''
  const capacity = sp.get('capacity') || ''
  const minCapacity = sp.get('minCapacity') || ''
  const date = sp.get('date') || isoToday()
  const start = sp.get('start') || ''
  const end = sp.get('end') || ''
  const durationParam = Number(sp.get('duration') || '60')

  const buildings = readMulti(sp, 'building')
  const types = readMulti(sp, 'type')
  const equipment = readMulti(sp, 'equipment')

  useEffect(() => {
    let ignore = false
    setFilterMetaError(false)
    getFilters()
      .then((payload) => {
        if (ignore) return
        setFilterMeta(payload || null)
      })
      .catch(() => {
        if (ignore) return
        setFilterMeta(null)
        setFilterMetaError(true)
      })
    return () => {
      ignore = true
    }
  }, [])

  // Measure where the top filter card ends so we can "dock" it into the left sidebar
  // after the user scrolls past it.
  useEffect(() => {
    if (isDocked) return
    const el = filterTopRef.current
    if (!el) return

    const calc = () => {
      const rect = el.getBoundingClientRect()
      setDockThresholdY(rect.bottom + window.scrollY)
    }

    calc()

    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => calc())
      ro.observe(el)
    }

    window.addEventListener('resize', calc)
    return () => {
      window.removeEventListener('resize', calc)
      if (ro) ro.disconnect()
    }
  }, [isDocked])

  useEffect(() => {
    if (!Number.isFinite(dockThresholdY)) return
    let ticking = false

    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        ticking = false
        const y = window.scrollY + DOCK_TOP_OFFSET_PX
        setIsDocked((prev) => {
          if (prev) {
            // Once docked, stay docked until the user reaches the true top.
            if (window.scrollY <= UNDOCK_AT_TOP_ONLY_PX) return false
            return true
          }
          return y >= dockThresholdY + DOCK_HYSTERESIS_PX
        })
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [dockThresholdY])

  const buildingOptions = filterMeta?.buildings || []
  const typeOptions = filterMeta?.types || []
  const equipmentOptions = filterMeta?.equipment || []
  const isLoadingFilterMeta = !filterMeta && !filterMetaError

  const derivedDuration = useMemo(() => {
    const s = parseTimeToMinutes(start)
    const e = parseTimeToMinutes(end)
    if (s === null || e === null) return clampBookingDuration(durationParam)
    const diff = e - s
    if (!Number.isFinite(diff) || diff <= 0) return clampBookingDuration(durationParam)
    return clampBookingDuration(diff)
  }, [start, end, durationParam])

  const startForAvailability = start || '10:00'
  const durationForAvailability = derivedDuration

  const buildingsKey = useMemo(() => buildings.join(','), [buildings])
  const typesKey = useMemo(() => types.join(','), [types])
  const equipmentKey = useMemo(() => equipment.join(','), [equipment])
  const page = Math.max(1, Number(sp.get('page') || '1'))

  const [searchDraft, setSearchDraft] = useState(q)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [glimpsesById, setGlimpsesById] = useState({})

  const searchContext = useMemo(() => {
    const next = new URLSearchParams(sp)
    next.delete('page')
    next.delete('facilityId')
    next.delete('slot')
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
      setSearchError('')
    })

    const selectedBuildings = buildingsKey ? buildingsKey.split(',').filter(Boolean) : []
    const selectedTypes = typesKey ? typesKey.split(',').filter(Boolean) : []
    const selectedEquipment = equipmentKey ? equipmentKey.split(',').filter(Boolean) : []
    const sharedParams = {
      capacity,
      minCapacity,
      date,
      start: startForAvailability,
      end: end || '',
    }

    const requestPromise = q && selectedBuildings.length > 0
      ? Promise.all([
          searchFacilities({
            ...sharedParams,
            q,
            type: selectedTypes,
            equipment: selectedEquipment,
            page: 1,
            pageSize: CLIENT_MERGE_PAGE_SIZE,
          }),
          searchFacilities({
            ...sharedParams,
            building: selectedBuildings,
            type: selectedTypes,
            equipment: selectedEquipment,
            page: 1,
            pageSize: CLIENT_MERGE_PAGE_SIZE,
          }),
        ]).then(([queryPayload, chipPayload]) => mergeFacilityPayloads(queryPayload, chipPayload, page, RESULTS_PAGE_SIZE))
      : searchFacilities({
          q,
          ...sharedParams,
          building: selectedBuildings,
          type: selectedTypes,
          equipment: selectedEquipment,
          page,
          pageSize: RESULTS_PAGE_SIZE,
        })

    requestPromise
      .then((payload) => {
        if (ignore) return
        setData(payload)
      })
      .catch(() => {
        if (ignore) return
        setData(null)
        setSearchError('Unable to load rooms right now. Please try again.')
      })
      .finally(() => {
        if (ignore) return
        setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [q, capacity, minCapacity, buildingsKey, typesKey, equipmentKey, date, startForAvailability, end, page])

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
    getAvailabilityGlimpse({ ids, date, start: startForAvailability, duration: 60, limit: 3 })
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
  }, [resultIdsKey, resultIds, date, startForAvailability])

  const setSearchParamsNoScroll = (nextParams) => {
    pendingScrollRestoreYRef.current = window.scrollY
    const q = nextParams.toString()
    navigate({ search: q ? `?${q}` : '' }, { replace: true, preventScrollReset: true })
  }

  // Some router setups still reset scroll on search-param changes; restore it after navigation.
  useLayoutEffect(() => {
    const y = pendingScrollRestoreYRef.current
    if (y === null) return
    pendingScrollRestoreYRef.current = null

    // Restore multiple times to win against late scroll resets.
    window.requestAnimationFrame(() => window.scrollTo({ top: y }))
    setTimeout(() => window.scrollTo({ top: y }), 0)
    setTimeout(() => window.scrollTo({ top: y }), 50)
  }, [location.search])

  useEffect(() => {
    setSearchDraft(q)
  }, [q])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(sp)
    if (!value) next.delete(key)
    else next.set(key, value)
    next.set('page', '1')
    setSearchParamsNoScroll(next)
  }

  const updateMany = (updates) => {
    const next = new URLSearchParams(sp)
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === '') next.delete(key)
      else next.set(key, String(value))
    }
    next.set('page', '1')
    setSearchParamsNoScroll(next)
  }

  const commitSearch = (value) => {
    const next = new URLSearchParams(sp)
    const normalized = String(value || '').trim()
    if (normalized) next.set('q', normalized)
    else next.delete('q')
    next.set('page', '1')
    setSearchParamsNoScroll(next)
  }

  const toggleMulti = (key, value) => {
    const current = readMulti(sp, key)
    const set = new Set(current)
    if (set.has(value)) set.delete(value)
    else set.add(value)
    const next = new URLSearchParams(sp)
    const arr = Array.from(set)
    if (arr.length) next.set(key, arr.join(','))
    else next.delete(key)
    next.set('page', '1')
    setSearchParamsNoScroll(next)
  }

  const updateStart = (nextStart) => {
    if (!nextStart) {
      updateMany({ start: '', end: '', duration: '' })
      return
    }
    const sMin = parseTimeToMinutes(nextStart)
    const eMin = parseTimeToMinutes(end)
    if (sMin === null) {
      updateMany({ start: nextStart })
      return
    }

    if (eMin === null) {
      updateMany({ start: nextStart })
      return
    }

    if (eMin <= sMin) {
      updateMany({ start: nextStart, end: '' })
      return
    }

    updateMany({ start: nextStart, end, duration: clampBookingDuration(eMin - sMin) })
  }

  const updateEnd = (nextEnd) => {
    if (!start) {
      updateMany({ end: '' })
      return
    }
    if (!nextEnd) {
      updateMany({ end: '' })
      return
    }
    const sMin = parseTimeToMinutes(start)
    const eMin = parseTimeToMinutes(nextEnd)
    if (sMin === null || eMin === null || eMin <= sMin) {
      updateMany({ end: '' })
      return
    }
    updateMany({ end: nextEnd, duration: clampBookingDuration(eMin - sMin) })
  }

  const onPageChange = (nextPage) => {
    const next = new URLSearchParams(sp)
    next.set('page', String(nextPage))
    setSearchParamsNoScroll(next)
  }

  const goToCalendar = (facilityId) => {
    const next = new URLSearchParams(sp)
    next.delete('page')
    next.delete('facilityId')
    next.delete('slot')
    if (date) next.set('date', date)
    next.set('start', startForAvailability)
    next.set('duration', String(durationForAvailability))
    navigate(`/facility/${encodeURIComponent(facilityId)}/calendar?${next.toString()}`)
  }

  const filterCard = (
    <div className="card cardPad">
      <div className="stack" style={{ gap: 14 }}>
        <div className="filterCardHeader">
          <div className="filterCardIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 5h18" />
              <path d="M6 10h12" />
              <path d="M10 15h4" />
              <path d="M11 20h2" />
            </svg>
          </div>
          <div>Filter Rooms</div>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <div className="field">
            <div className="label">Search</div>
            <input
              type="search"
              className="input"
              value={searchDraft}
              placeholder="Search by building, room number, name, or equipment"
              onChange={(e) => {
                const nextValue = e.target.value
                setSearchDraft(nextValue)
                if (nextValue === '') commitSearch('')
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                commitSearch(searchDraft)
              }}
              aria-label="Search facilities"
            />
          </div>
        </div>

        <div className="filterGridTop" aria-label="Date and time filters">
          <div className="field">
            <div className="label">Date</div>
            <input className="input" type="date" value={date} onChange={(e) => updateParam('date', e.target.value)} />
          </div>

          <div className="field">
            <div className="label">Start Time</div>
            <select className="select" value={start} onChange={(e) => updateStart(e.target.value)}>
              <option value="">Any time</option>
              {START_TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <div className="label">End Time</div>
            <select className="select" value={end} onChange={(e) => updateEnd(e.target.value)} disabled={!start}>
              <option value="">Any time</option>
              {(() => {
                const sMin = parseTimeToMinutes(start)
                if (sMin === null) return null
                return END_TIME_OPTIONS.filter((t) => {
                  const m = parseTimeToMinutes(t)
                  return m !== null && m > sMin
                }).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))
              })()}
            </select>
          </div>
        </div>

        <div className="divider" style={{ margin: 0 }} />

        {isLoadingFilterMeta ? (
          <div className="muted" style={{ fontSize: 12 }}>
            Loading filter options…
          </div>
        ) : filterMetaError ? (
          <div className="muted" style={{ fontSize: 12 }}>
            Filter options unavailable (backend not reachable).
          </div>
        ) : null}

        <div className="filterSection">
          <div className="filterSectionTitle">Buildings ({buildings.length} selected)</div>
          <div className="filterChips">
            {buildingOptions.map((b) => (
              <button
                key={b}
                type="button"
                className={`filterChipBtn ${buildings.includes(b) ? 'filterChipBtnActive' : ''}`}
                onClick={() => toggleMulti('building', b)}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="filterSection">
          <div className="filterSectionTitle">Facility Types ({types.length} selected)</div>
          <div className="filterChips">
            {typeOptions.map((t) => (
              <button
                key={t}
                type="button"
                className={`filterChipBtn ${types.includes(t) ? 'filterChipBtnActive' : ''}`}
                onClick={() => toggleMulti('type', t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="filterSection">
          <div className="filterSectionTitle">Capacity</div>
          <div className="filterGridTop" style={{ gridTemplateColumns: '1fr' }} aria-label="Capacity range">
            <div className="field">
              <div className="label">Select capacity</div>
              <select className="select" value={capacity} onChange={(e) => updateMany({ capacity: e.target.value, minCapacity: '' })}>
                {CAPACITY_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'any'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="filterSection">
          <div className="filterSectionTitle">Equipment ({equipment.length} selected)</div>
          <div className="filterChips">
            {equipmentOptions.map((eq) => (
              <button
                key={eq}
                type="button"
                className={`filterChipBtn ${equipment.includes(eq) ? 'filterChipBtnActive' : ''}`}
                onClick={() => toggleMulti('equipment', eq)}
              >
                {eq}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const resultsContent = searchError ? (
    <div className="card cardPad">
      <div className="h2">Search unavailable</div>
      <div className="muted">{searchError}</div>
    </div>
  ) : !data && isLoading ? (
    <div className="card cardPad">Loading…</div>
  ) : data?.items?.length ? (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="pill">
          {data.total} rooms • Showing {data.items.length} (page {data.page})
        </span>
        <span className="pill">{isLoading ? 'Updating…' : 'Sorted: relevance'}</span>
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
        {q
          ? `No rooms matched "${q}". Try a broader phrase, remove some filters, or clear the search.`
          : 'Try a different keyword, reduce equipment requirements, or adjust capacity.'}
      </div>
    </div>
  )

  return (
    <AppShell>
      <div className="containerBleed">
        <div className="searchPage" style={{ paddingBottom: '200px' }}>
          <div className={`searchDockedLayout ${isDocked ? 'searchDockedLayoutDocked' : ''}`}>
            <aside className="searchSidebar" aria-label="Filters" aria-hidden={!isDocked ? 'true' : undefined}>
              <div className="searchSidebarSticky">
                {isDocked ? <div className="searchFilterDock searchFilterDockActive">{filterCard}</div> : null}
              </div>
            </aside>

            <main className="searchMain" aria-label="Results">
              {!isDocked ? (
                <div ref={filterTopRef} className="searchFilterTop">
                  {filterCard}
                </div>
              ) : null}
              <div className="stack">{resultsContent}</div>
            </main>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
