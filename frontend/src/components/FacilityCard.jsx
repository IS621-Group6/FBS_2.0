import { Link } from 'react-router-dom'

export default function FacilityCard({
  facility,
  searchContext,
  onSelect,
  isSelected = false,
  availabilityGlimpse,
}) {
  const equipment = facility.equipment || []

  const detailUrl = `/facility/${encodeURIComponent(facility.id)}`
  const calendarUrl = `/facility/${encodeURIComponent(facility.id)}/calendar${searchContext ? `?${searchContext}` : ''}`

  return (
    <div className="card facilityCard">
      <div className="stack" style={{ gap: 10 }}>
        <div>
          <h3 className="facilityTitle">{facility.name}</h3>
          <div className="facilityMeta">
            <span>{facility.campus}</span>
            <span>•</span>
            <span>{facility.building}</span>
            <span>•</span>
            <span>Capacity {facility.capacity}</span>
          </div>
        </div>

        <div className="row">
          {equipment.slice(0, 4).map((eq) => (
            <span key={eq} className="chip">
              {eq}
            </span>
          ))}
          {equipment.length > 4 ? <span className="muted2">+{equipment.length - 4} more</span> : null}
        </div>

        <div className="row" style={{ alignItems: 'center' }}>
          {availabilityGlimpse?.status === 'loading' ? (
            <span className="muted2" style={{ fontSize: 12 }}>
              Checking next available…
            </span>
          ) : availabilityGlimpse?.status === 'no_slots' ? (
            <span className="muted2" style={{ fontSize: 12 }}>
              No free slots in the remaining day
            </span>
          ) : availabilityGlimpse?.status === 'ok' ? (
            <>
              <span className="muted2" style={{ fontSize: 12, marginRight: 6 }}>
                Next available:
              </span>
              {(availabilityGlimpse.nextSlots || []).slice(0, 3).map((s) => (
                <span key={`${s.start}-${s.end}`} className="chip">
                  {s.start}
                </span>
              ))}
            </>
          ) : null}
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted2">Room ID: {facility.id}</span>
          <div className="row" style={{ gap: 10 }}>
            <Link className="btn" to={detailUrl}>
              Details
            </Link>
            {onSelect ? (
              <button className="btn btnPrimary" onClick={onSelect} aria-pressed={isSelected}>
                {isSelected ? 'Selected' : 'Select & book'}
              </button>
            ) : (
              <Link className="btn btnPrimary" to={calendarUrl}>
                Check availability
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
