import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { cancelBooking, getBookings, modifyBooking } from '../lib/api'
import useAuth from '../lib/useAuth'

function formatStatus(status) {
  const raw = String(status || 'active').toLowerCase()
  if (raw === 'confirmed') return 'active'
  return raw
}

function isoDateFromParts(year, monthIndexZeroBased, dayOfMonth) {
  const mm = String(monthIndexZeroBased + 1).padStart(2, '0')
  const dd = String(dayOfMonth).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function isoFromDate(d) {
  return isoDateFromParts(d.getFullYear(), d.getMonth(), d.getDate())
}

function addMonths(date, deltaMonths) {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() + deltaMonths)
  return d
}

function bookingStartDateTime(booking) {
  const date = String(booking?.date || '')
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date)
  if (!m) return null
  const year = Number(m[1])
  const monthIndex = Number(m[2]) - 1
  const day = Number(m[3])
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null

  const [hhRaw, mmRaw] = String(booking?.start || '00:00').split(':')
  const hh = Number(hhRaw)
  const mm = Number(mmRaw)
  const hour = Number.isFinite(hh) ? hh : 0
  const minute = Number.isFinite(mm) ? mm : 0
  return new Date(year, monthIndex, day, hour, minute, 0, 0)
}

function isCancelledStatus(status) {
  const raw = formatStatus(status)
  return raw === 'cancelled' || raw === 'canceled'
}

export default function ViewBookingsPage() {
  const { user } = useAuth()
  const userEmail = user?.email || ''

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCancellingById, setIsCancellingById] = useState({})
  const [confirmCancel, setConfirmCancel] = useState(null)
  const [cancelSuccess, setCancelSuccess] = useState(null)
  const [modifyingBooking, setModifyingBooking] = useState(null)
  const [modifyForm, setModifyForm] = useState({ date: '', start: '', end: '' })
  const [isModifying, setIsModifying] = useState(false)
  const [modifyError, setModifyError] = useState('')

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selectedDate, setSelectedDate] = useState('')

  const todayIso = useMemo(() => isoFromDate(new Date()), [])

  const sortedItems = useMemo(() => {
    const now = new Date()
    const list = Array.isArray(items) ? [...items] : []

    list.sort((a, b) => {
      const sa = formatStatus(a?.status)
      const sb = formatStatus(b?.status)
      const aCancelled = sa === 'cancelled' || sa === 'canceled'
      const bCancelled = sb === 'cancelled' || sb === 'canceled'

      const aDt = bookingStartDateTime(a)
      const bDt = bookingStartDateTime(b)
      const aFuture = aDt ? aDt.getTime() >= now.getTime() : false
      const bFuture = bDt ? bDt.getTime() >= now.getTime() : false

      const aGroup = aCancelled ? 2 : aFuture ? 0 : 1
      const bGroup = bCancelled ? 2 : bFuture ? 0 : 1
      if (aGroup !== bGroup) return aGroup - bGroup

      // Upcoming: soonest first. Past/cancelled: most recent first.
      const aTime = aDt ? aDt.getTime() : 0
      const bTime = bDt ? bDt.getTime() : 0
      if (aGroup === 0) {
        if (aTime !== bTime) return aTime - bTime
      } else {
        if (aTime !== bTime) return bTime - aTime
      }

      const an = String(a?.facilityName || a?.facilityId || '')
      const bn = String(b?.facilityName || b?.facilityId || '')
      const byName = an.localeCompare(bn)
      if (byName) return byName

      return String(a?.id || '').localeCompare(String(b?.id || ''))
    })

    return list
  }, [items])

  const activeCount = useMemo(() => sortedItems.filter((item) => formatStatus(item.status) === 'active').length, [sortedItems])

  const bookingsByDate = useMemo(() => {
    const map = new Map()
    for (const item of sortedItems) {
      if (isCancelledStatus(item?.status)) continue
      const key = item?.date
      if (!key) continue
      const arr = map.get(key) || []
      arr.push(item)
      map.set(key, arr)
    }

    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => String(a?.start || '').localeCompare(String(b?.start || '')))
      map.set(key, arr)
    }

    return map
  }, [sortedItems])

  const visibleItems = useMemo(() => {
    if (!selectedDate) return sortedItems
    return sortedItems.filter((item) => item?.date === selectedDate)
  }, [sortedItems, selectedDate])

  const groupedVisibleItems = useMemo(() => {
    const now = new Date()

    const groups = {
      upcoming: [],
      past: [],
      cancelled: [],
    }

    for (const item of visibleItems) {
      const status = formatStatus(item?.status)
      const isCancelled = status === 'cancelled' || status === 'canceled'
      if (isCancelled) {
        groups.cancelled.push(item)
        continue
      }

      const dt = bookingStartDateTime(item)
      const isFuture = dt ? dt.getTime() >= now.getTime() : false
      if (isFuture) groups.upcoming.push(item)
      else groups.past.push(item)
    }

    const nameKey = (b) => String(b?.facilityName || b?.facilityId || '').trim().toLowerCase()
    const alphaThenTime = (a, b) => {
      const an = nameKey(a)
      const bn = nameKey(b)
      const byName = an.localeCompare(bn)
      if (byName) return byName

      const aDt = bookingStartDateTime(a)
      const bDt = bookingStartDateTime(b)
      const aTime = aDt ? aDt.getTime() : 0
      const bTime = bDt ? bDt.getTime() : 0
      if (aTime !== bTime) return aTime - bTime

      return String(a?.id || '').localeCompare(String(b?.id || ''))
    }

    groups.upcoming.sort(alphaThenTime)
    groups.past.sort(alphaThenTime)
    groups.cancelled.sort(alphaThenTime)

    return [
      { key: 'upcoming', title: 'Upcoming', items: groups.upcoming },
      { key: 'past', title: 'Past', items: groups.past },
      { key: 'cancelled', title: 'Cancelled', items: groups.cancelled },
    ]
  }, [visibleItems])

  const monthMeta = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const monthIndex = calendarMonth.getMonth()
    const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(calendarMonth)

    // Month grid: up to 6 weeks, but trim fully-empty placeholder weeks.
    const firstOfMonth = new Date(year, monthIndex, 1)
    const firstDow = firstOfMonth.getDay() // 0=Sun
    const gridStart = new Date(year, monthIndex, 1 - firstDow)

    const weeks = []
    for (let w = 0; w < 6; w++) {
      const week = []
      for (let dow = 0; dow < 7; dow++) {
        const i = w * 7 + dow
        const d = new Date(gridStart)
        d.setDate(gridStart.getDate() + i)
        const iso = isoFromDate(d)
        week.push({
          day: d.getDate(),
          iso,
          inMonth: d.getMonth() === monthIndex,
        })
      }
      weeks.push(week)
    }

    // Remove trailing rows that are entirely outside the current month.
    while (weeks.length > 1 && weeks[weeks.length - 1].every((c) => !c.inMonth)) {
      weeks.pop()
    }

    const cells = weeks.flat()

    return { monthLabel, year, monthIndex, cells }
  }, [calendarMonth])

  const monthBookingCount = useMemo(() => {
    const y = monthMeta.year
    const m = monthMeta.monthIndex
    let count = 0
    for (const item of items) {
      if (isCancelledStatus(item?.status)) continue
      const d = String(item?.date || '')
      const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(d)
      if (!match) continue
      const yy = Number(match[1])
      const mm = Number(match[2]) - 1
      if (yy === y && mm === m) count += 1
    }
    return count
  }, [items, monthMeta.year, monthMeta.monthIndex])

  const loadBookings = useCallback(async () => {
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
  }, [userEmail])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  // Keep the selected date visible in the calendar.
  useEffect(() => {
    if (!selectedDate) return
    const m = /^([0-9]{4})-([0-9]{2})-/.exec(selectedDate)
    if (!m) return
    const year = Number(m[1])
    const monthIndex = Number(m[2]) - 1
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return
    const d = new Date(year, monthIndex, 1)
    setCalendarMonth(d)
  }, [selectedDate])

  const handleCancel = async (booking) => {
    if (!booking || !userEmail) return
    const bookingId = String(booking.id || '').replace(/^B-/, '')
    setIsCancellingById((prev) => ({ ...prev, [bookingId]: true }))
    try {
      await cancelBooking(bookingId, userEmail)
      await loadBookings()
      setCancelSuccess(booking.id)
      setConfirmCancel(null)
    } catch (e) {
      alert(e?.message || 'Unable to cancel booking')
    } finally {
      setIsCancellingById((prev) => ({ ...prev, [bookingId]: false }))
    }
  }

  const handleOpenModify = (booking) => {
    setModifyingBooking(booking)
    setModifyForm({
      date: booking.date || '',
      start: booking.start || '',
      end: booking.end || '',
    })
    setModifyError('')
  }

  const handleCloseModify = () => {
    setModifyingBooking(null)
    setModifyForm({ date: '', start: '', end: '' })
    setModifyError('')
    setIsModifying(false)
  }

  const handleModifyFormChange = (field, value) => {
    setModifyForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmitModify = async (e) => {
    e.preventDefault()
    if (!modifyingBooking || !userEmail) return

    const { date, start, end } = modifyForm
    if (!date || !start || !end) {
      setModifyError('All fields are required')
      return
    }

    // Simple local validation to ensure end time is after start time.
    const [startHour, startMinute] = String(start).split(':').map(Number)
    const [endHour, endMinute] = String(end).split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
      setModifyError('End time must be after start time')
      return
    }

    if (endMinutes - startMinutes > 180) {
      setModifyError('Bookings are limited to 3 hours')
      return
    }
    const plainId = String(modifyingBooking.id || '').replace(/^B-/, '')
    setIsModifying(true)
    setModifyError('')

    try {
      await modifyBooking(plainId, { date, start, end }, userEmail)
      await loadBookings()
      handleCloseModify()
    } catch (e) {
      setModifyError(e?.message || 'Unable to modify booking')
    } finally {
      setIsModifying(false)
    }
  }

  const confirmCancelPlainId = confirmCancel ? String(confirmCancel.id || '').replace(/^B-/, '') : ''

  return (
    <AppShell>
      <div className="containerBleed">
        <div className="stack">
          <div>
            <h1 className="h1">My bookings</h1>
            <div className="muted2" style={{ marginTop: 10 }}>
              {activeCount} active bookings
              {selectedDate ? ` • ${visibleItems.length} on ${selectedDate}` : ''}
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
            <div className="emptyState" role="status" aria-live="polite">
              <svg className="emptyStateIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4" />
                <path d="M3 10h18" />
              </svg>
              <h2 className="emptyStateTitle">No Bookings Yet</h2>
              <p className="emptyStateSubtitle">Start by booking a room from the available options.</p>
            </div>
          ) : null}

          {!isLoading && !error && items.length > 0 ? (
            <div className="stack" style={{ gap: 12 }}>
              <div className="card cardPad">
                <div className="stack" style={{ gap: 12 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="h2" style={{ margin: 0 }}>Calendar</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{monthBookingCount} bookings this month</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Today: {todayIso}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="btn" type="button" onClick={() => setCalendarMonth((d) => addMonths(d, -1))}>
                        Prev
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          const d = new Date()
                          d.setDate(1)
                          setCalendarMonth(d)
                          setSelectedDate('')
                        }}
                      >
                        Today
                      </button>
                      <span className="pill">{monthMeta.monthLabel}</span>
                      <button className="btn" type="button" onClick={() => setCalendarMonth((d) => addMonths(d, 1))}>
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="monthCalendarWeekdays" aria-hidden="true">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="monthCalendarWeekday">{d}</div>
                    ))}
                  </div>

                  <div className="monthCalendarGrid" role="grid" aria-label={`Bookings calendar for ${monthMeta.monthLabel}`}>
                    {monthMeta.cells.map((cell, idx) => {
                      if (!cell) return <div key={`blank-${idx}`} className="monthCalendarBlank" aria-hidden="true" />

                      // Only show days that belong to the current month (keep grid spacing).
                      if (!cell.inMonth) {
                        return <div key={cell.iso} className="monthCalendarDayPlaceholder" aria-hidden="true" />
                      }

                      const dayBookings = bookingsByDate.get(cell.iso) || []
                      const count = dayBookings.length
                      const isSelected = selectedDate === cell.iso
                      const isToday = cell.iso === todayIso
                      const isPast = !isToday && cell.iso < todayIso
                      return (
                        <button
                          key={cell.iso}
                          type="button"
                          className={`slotBtn monthCalendarDayBtn ${isToday ? 'monthCalendarDayToday' : ''} ${isPast ? 'monthCalendarDayPast' : ''} ${isSelected ? 'slotSelected' : ''} ${count ? 'monthCalendarDayHasBookings' : ''}`}
                          onClick={() => setSelectedDate((prev) => (prev === cell.iso ? '' : cell.iso))}
                          aria-label={count ? `${cell.iso}: ${count} bookings` : `${cell.iso}: no bookings`}
                        >
                          <div className="monthCalendarDayNumber">{cell.day}</div>
                          {count ? (
                            <div className="monthCalendarEvents">
                              {dayBookings.slice(0, 2).map((b) => {
                                const label = `${b.start || ''}–${b.end || ''} ${b.facilityName || b.facilityId || ''}`.trim()
                                const timeRange = `${b.start || '—'}–${b.end || '—'}`
                                return (
                                  <div key={b.id} className="monthCalendarEvent" title={label}>
                                    <span className="monthCalendarEventTime">{timeRange}</span> {b.facilityName || b.facilityId || 'Booking'}
                                  </div>
                                )
                              })}
                              {count > 2 ? <div className="monthCalendarEventMore">+{count - 2} more</div> : null}
                            </div>
                          ) : (
                            <div className="monthCalendarDayCountMuted">&nbsp;</div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <button className="btn" type="button" onClick={loadBookings}>
                      Refresh
                    </button>
                    {selectedDate ? (
                      <button className="btn btnPrimary" type="button" onClick={() => setSelectedDate('')}>
                        Show all dates
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>Click a day to filter bookings</span>
                    )}
                  </div>
                </div>
              </div>

              {visibleItems.length === 0 ? (
                <div className="card cardPad" role="status" aria-live="polite">
                  <div className="h2">No bookings for {selectedDate}</div>
                  <div className="muted">Choose another day or click “Show all dates”.</div>
                </div>
              ) : null}

              {groupedVisibleItems.map((group) => {
                if (!group.items.length) return null

                return (
                  <div key={group.key} className="stack" style={{ gap: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div className="h2" style={{ margin: 0 }}>{group.title}</div>
                      <span className="pill">{group.items.length}</span>
                    </div>

                    {group.items.map((booking) => {
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

                            <div className="row" style={{ justifyContent: 'flex-end' }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => handleOpenModify(booking)}
                                  disabled={!canCancel}
                                >
                                  Modify
                                </button>
                                <button
                                  className="btn btnPrimary"
                                  type="button"
                                  onClick={() => setConfirmCancel(booking)}
                                  disabled={!canCancel || isCancelling}
                                >
                                  {isCancelling ? 'Cancelling…' : canCancel ? 'Cancel booking' : 'Not cancellable'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        {modifyingBooking ? (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={isModifying ? undefined : handleCloseModify}
          >
            <div
              className="card cardPad"
              style={{ maxWidth: 500, width: '90%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmitModify}>
                <div className="stack">
                  <div className="h2">Modify Booking</div>
                  <div className="muted">
                    {modifyingBooking.facilityName || modifyingBooking.facilityId} - {modifyingBooking.id}
                  </div>

                  {modifyError ? (
                    <div className="alert alertDanger">
                      <div className="muted">{modifyError}</div>
                    </div>
                  ) : null}

                  <div className="stack" style={{ gap: 12 }}>
                    <div>
                      <label htmlFor="modify-date" className="label">
                        Date
                      </label>
                      <input
                        id="modify-date"
                        type="date"
                        className="input"
                        value={modifyForm.date}
                        onChange={(e) => handleModifyFormChange('date', e.target.value)}
                        required
                        disabled={isModifying}
                      />
                    </div>

                    <div className="grid2">
                      <div>
                        <label htmlFor="modify-start" className="label">
                          Start Time
                        </label>
                        <input
                          id="modify-start"
                          type="time"
                          className="input"
                          value={modifyForm.start}
                          onChange={(e) => handleModifyFormChange('start', e.target.value)}
                          required
                          disabled={isModifying}
                        />
                      </div>

                      <div>
                        <label htmlFor="modify-end" className="label">
                          End Time
                        </label>
                        <input
                          id="modify-end"
                          type="time"
                          className="input"
                          value={modifyForm.end}
                          onChange={(e) => handleModifyFormChange('end', e.target.value)}
                          required
                          disabled={isModifying}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn" type="button" onClick={handleCloseModify} disabled={isModifying}>
                      Cancel
                    </button>
                    <button className="btn btnPrimary" type="submit" disabled={isModifying}>
                      {isModifying ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {confirmCancel ? (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div className="card cardPad" style={{ maxWidth: 400, width: '100%', margin: 'var(--space-6)' }}>
              <div className="stack" style={{ gap: 16 }}>
                <div className="h2">Cancel Booking</div>
                <div>
                  Are you sure you want to cancel this booking?
                  <br />
                  <strong>Booking ID:</strong> {confirmCancel.id}
                  <br />
                  <strong>Date:</strong> {confirmCancel.date}
                  <br />
                  <strong>Time:</strong> {confirmCancel.start}–{confirmCancel.end}
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <button
                    className="btn"
                    onClick={() => setConfirmCancel(null)}
                    disabled={Boolean(isCancellingById[confirmCancelPlainId])}
                  >
                    Keep Booking
                  </button>
                  <button
                    className="btn btnPrimary"
                    onClick={() => handleCancel(confirmCancel)}
                    disabled={Boolean(isCancellingById[confirmCancelPlainId])}
                  >
                    {isCancellingById[confirmCancelPlainId] ? 'Cancelling…' : 'Cancel Booking'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {cancelSuccess ? (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div className="card cardPad" style={{ maxWidth: 400, width: '100%', margin: 'var(--space-6)' }}>
              <div className="stack" style={{ gap: 16 }}>
                <div className="h2">Booking Cancelled</div>
                <div>
                  Confirmed. Your booking was cancelled.
                  <br />
                  <strong>Booking ID:</strong> {cancelSuccess}
                </div>
                <div className="row">
                  <button className="btn btnPrimary" onClick={() => setCancelSuccess(null)}>
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
