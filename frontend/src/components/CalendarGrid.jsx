import { useMemo, useState } from 'react'
import { formatTimeLabel, overlaps, parseTimeToMinutes } from '../lib/time'

function buildSlots({ startMinutes, endMinutes, stepMinutes }) {
  const slots = []
  for (let t = startMinutes; t < endMinutes; t += stepMinutes) {
    slots.push(t)
  }
  return slots
}

export default function CalendarGrid({
  date,
  reservations,
  selectedStart,
  selectedDuration,
  onSelectStart,
  businessHours = { start: '08:00', end: '22:00' },
}) {
  const [hoverStartMin, setHoverStartMin] = useState(null)

  const startMinutes = parseTimeToMinutes(businessHours.start) ?? 8 * 60
  const endMinutes = parseTimeToMinutes(businessHours.end) ?? 22 * 60
  const stepMinutes = 30

  const slots = buildSlots({ startMinutes, endMinutes, stepMinutes })

  const selectedStartMin = parseTimeToMinutes(selectedStart)

  const activeStartMin = hoverStartMin ?? selectedStartMin
  const activeEndMin = activeStartMin !== null ? activeStartMin + selectedDuration : null

  const blocks = useMemo(
    () =>
      (reservations || []).map((r) => ({
        start: parseTimeToMinutes(r.start),
        end: parseTimeToMinutes(r.end),
      })),
    [reservations]
  )

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="muted">
          <strong>Availability for</strong> {date}
        </div>
        <div className="row">
          <span className="pill">
            <span className="chip" style={{ background: 'rgba(15,118,110,0.08)' }}>
              Available
            </span>
          </span>
          <span className="pill">
            <span className="chip" style={{ background: 'rgba(148,163,184,0.18)', borderColor: 'rgba(148,163,184,0.3)', color: '#334155' }}>
              Unavailable
            </span>
          </span>
          <span className="pill">
            <span className="chip" style={{ background: 'rgba(11,77,162,0.12)' }}>
              Selected
            </span>
          </span>
        </div>
      </div>

      <div
        className="calendarGrid"
        role="grid"
        aria-label="Time slots"
        onMouseLeave={() => setHoverStartMin(null)}
      >
        {slots.map((slotMin) => {
          const label = formatTimeLabel(slotMin)
          const endMin = slotMin + selectedDuration

          const isBlocked = blocks.some((b) => overlaps(slotMin, endMin, b.start, b.end))
          const isSelected =
            activeStartMin !== null &&
            activeEndMin !== null &&
            slotMin >= activeStartMin &&
            slotMin < activeEndMin

          const cls = ['slotBtn']
          if (!isBlocked) cls.push('slotAvailable')
          if (isBlocked) cls.push('slotUnavailable')
          if (isSelected) cls.push('slotSelected')

          return (
            <button
              key={label}
              role="gridcell"
              className={cls.join(' ')}
              disabled={isBlocked}
              onClick={() => onSelectStart(label)}
              onMouseEnter={() => {
                if (isBlocked) return
                setHoverStartMin(slotMin)
              }}
              onFocus={() => {
                if (isBlocked) return
                setHoverStartMin(slotMin)
              }}
              aria-disabled={isBlocked}
              aria-label={isBlocked ? `${label} unavailable` : `${label} available`}
              title={isBlocked ? 'This start time overlaps an existing booking.' : 'Select this start time'}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
