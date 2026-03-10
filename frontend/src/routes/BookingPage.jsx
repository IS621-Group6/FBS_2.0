import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import CalendarGrid from '../components/CalendarGrid'
import { createBooking, getAvailability, getFacility, searchFacilities } from '../lib/api'
import useAuth from '../lib/useAuth'
import { isoToday, parseTimeToMinutes } from '../lib/time'

const STEPS = {
  FACILITY: 1,
  SLOT: 2,
  CONFIRM: 3,
}

const STEP_NAMES = {
  1: 'Select Facility',
  2: 'Select Date & Time',
  3: 'Confirm Booking',
}

export default function BookingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userEmail = user?.email || ''

  const [currentStep, setCurrentStep] = useState(STEPS.FACILITY)
  const [searchQuery, setSearchQuery] = useState('')
  const [facilities, setFacilities] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  const [selectedFacility, setSelectedFacility] = useState(null)
  const [selectedDate, setSelectedDate] = useState(isoToday())
  const [selectedStart, setSelectedStart] = useState('10:00')
  const [selectedDuration, setSelectedDuration] = useState(60)
  const [selectedReason, setSelectedReason] = useState('')

  const [reservations, setReservations] = useState([])
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Calculate end time
  const selectedEnd = useMemo(() => {
    const startMin = parseTimeToMinutes(selectedStart)
    if (startMin === null) return ''
    const endMin = startMin + selectedDuration
    const hh = String(Math.floor(endMin / 60)).padStart(2, '0')
    const mm = String(endMin % 60).padStart(2, '0')
    return `${hh}:${mm}`
  }, [selectedStart, selectedDuration])

  // Load facilities on mount
  useEffect(() => {
    let ignore = false

    setIsSearching(true)
    setError('')
    searchFacilities({ q: '' })
      .then((results) => {
        if (ignore) return
        setFacilities(results?.items || [])
      })
      .catch((e) => {
        if (ignore) return
        setError(e?.message || 'Search failed')
        setFacilities([])
      })
      .finally(() => {
        if (ignore) return
        setIsSearching(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  // Load facility details when selected
  useEffect(() => {
    if (!selectedFacility?.id) return
    let ignore = false

    getFacility(selectedFacility.id)
      .then((payload) => {
        if (ignore) return
        setSelectedFacility(payload)
      })
      .catch(() => {
        if (ignore) return
        setError('Failed to load facility details')
      })

    return () => {
      ignore = true
    }
  }, [selectedFacility?.id])

  // Load availability when facility or date changes
  useEffect(() => {
    if (!selectedFacility?.id || currentStep !== STEPS.SLOT) return
    let ignore = false

    setIsLoadingAvailability(true)
    setError('')

    getAvailability(selectedFacility.id, selectedDate)
      .then((payload) => {
        if (ignore) return
        setReservations(payload.reservations || [])
      })
      .catch((e) => {
        if (ignore) return
        setError(e?.message || 'Failed to load availability')
        setReservations([])
      })
      .finally(() => {
        if (ignore) return
        setIsLoadingAvailability(false)
      })

    return () => {
      ignore = true
    }
  }, [selectedFacility?.id, selectedDate, currentStep])

  const handleSearch = async () => {
    setIsSearching(true)
    setError('')
    try {
      const results = await searchFacilities({ q: searchQuery })
      setFacilities(results?.items || [])
    } catch (e) {
      setError(e?.message || 'Search failed')
      setFacilities([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectFacility = (facility) => {
    setSelectedFacility(facility)
    setSelectedDate(isoToday())
    setSelectedStart('10:00')
    setSelectedDuration(60)
    setError('')
    setCurrentStep(STEPS.SLOT)
  }

  const handleSelectStart = (startTime) => {
    setSelectedStart(startTime)
    // Advance to confirmation step
    setCurrentStep(STEPS.CONFIRM)
  }

  const handleChangeDuration = (duration) => {
    setSelectedDuration(duration)
  }

  const handleChangeDate = (date) => {
    setSelectedDate(date)
  }

  const handleSubmitBooking = async () => {
    if (!selectedReason.trim()) {
      setError('Please enter a booking reason')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const booking = await createBooking({
        facilityId: selectedFacility.id,
        date: selectedDate,
        start: selectedStart,
        end: selectedEnd,
        userEmail,
        reason: selectedReason.trim(),
      })
      navigate(`/booking/success?id=${encodeURIComponent(booking.id)}`)
    } catch (e) {
      if (e.status === 409) {
        setError('This time slot is no longer available. Please select a different time.')
        setCurrentStep(STEPS.SLOT)
      } else {
        setError(e?.message || 'Booking failed')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const goBack = () => {
    if (currentStep === STEPS.SLOT) {
      setCurrentStep(STEPS.FACILITY)
      setSelectedDate(isoToday())
      setSelectedStart('10:00')
      setSelectedDuration(60)
    } else if (currentStep === STEPS.CONFIRM) {
      setCurrentStep(STEPS.SLOT)
    }
    setError('')
  }

  const canProceed = () => {
    if (currentStep === STEPS.FACILITY) return selectedFacility
    if (currentStep === STEPS.SLOT) return selectedStart && selectedEnd
    if (currentStep === STEPS.CONFIRM) return selectedReason.trim()
    return false
  }

  return (
    <AppShell>
      <div className="containerNarrow">
        <div className="stack">
          {/* Step Indicator */}
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <h1 className="h1">Book a Facility</h1>
              <div className="muted2">Step {currentStep} of 3</div>
            </div>

            {/* Progress Bar */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: 4,
                    backgroundColor: step <= currentStep ? '#2563eb' : '#e5e7eb',
                    borderRadius: 2,
                    transition: 'background-color 0.2s',
                  }}
                />
              ))}
            </div>

            {/* Step Name */}
            <div className="h2">{STEP_NAMES[currentStep]}</div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="alert alertDanger">
              <div className="muted">{error}</div>
            </div>
          )}

          {/* Step 1: Select Facility */}
          {currentStep === STEPS.FACILITY && (
            <div className="stack" style={{ gap: 16 }}>
              <div>
                <input
                  type="text"
                  className="input"
                  placeholder="Search facilities by name, building, or equipment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <button className="btn btnPrimary" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>

              {facilities.length === 0 && !isSearching && (
                <div className="card cardPad">
                  <div className="muted">No facilities found. Try a different search.</div>
                </div>
              )}

              {facilities.length > 0 && (
                <div className="stack" style={{ gap: 12 }}>
                  {facilities.map((facility) => (
                    <div
                      key={facility.id}
                      className="card cardPad"
                      style={{
                        cursor: 'pointer',
                        border:
                          selectedFacility?.id === facility.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => handleSelectFacility(facility)}
                    >
                      <div className="stack" style={{ gap: 8 }}>
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div className="h3">{facility.name || facility.id}</div>
                            <div className="muted">
                              {facility.building} • Capacity: {facility.capacity}
                            </div>
                          </div>
                          {selectedFacility?.id === facility.id && (
                            <div style={{ color: '#2563eb', fontSize: 20 }}>✓</div>
                          )}
                        </div>
                        {facility.equipment && facility.equipment.length > 0 && (
                          <div className="muted">
                            Equipment: {facility.equipment.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Date & Time */}
          {currentStep === STEPS.SLOT && selectedFacility && (
            <div className="stack" style={{ gap: 16 }}>
              <div className="card cardPad">
                <div className="muted">Selected: {selectedFacility.name || selectedFacility.id}</div>
              </div>

              {/* Date Selector */}
              <div>
                <label htmlFor="bookingDate" className="label">
                  Date
                </label>
                <input
                  id="bookingDate"
                  type="date"
                  className="input"
                  value={selectedDate}
                  onChange={(e) => handleChangeDate(e.target.value)}
                />
              </div>

              {/* Duration Selector */}
              <div>
                <label htmlFor="duration" className="label">
                  Duration (minutes)
                </label>
                <select
                  id="duration"
                  className="input"
                  value={selectedDuration}
                  onChange={(e) => handleChangeDuration(Number(e.target.value))}
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                  <option value={240}>4 hours</option>
                </select>
              </div>

              {/* Calendar Grid */}
              {isLoadingAvailability ? (
                <div className="card cardPad">
                  <div className="muted">Loading availability...</div>
                </div>
              ) : (
                <CalendarGrid
                  date={selectedDate}
                  reservations={reservations}
                  selectedStart={selectedStart}
                  selectedDuration={selectedDuration}
                  onSelectStart={handleSelectStart}
                />
              )}
            </div>
          )}

          {/* Step 3: Confirm Booking */}
          {currentStep === STEPS.CONFIRM && selectedFacility && (
            <div className="stack" style={{ gap: 16 }}>
              <div className="card cardPad">
                <div className="stack" style={{ gap: 10 }}>
                  <div className="h3">Booking Summary</div>

                  <div className="grid2">
                    <div className="alert">
                      <div className="alertTitle">Facility</div>
                      <div className="muted">{selectedFacility.name || selectedFacility.id}</div>
                    </div>
                    <div className="alert">
                      <div className="alertTitle">Capacity</div>
                      <div className="muted">{selectedFacility.capacity} people</div>
                    </div>
                  </div>

                  <div className="grid2">
                    <div className="alert">
                      <div className="alertTitle">Date</div>
                      <div className="muted">{selectedDate}</div>
                    </div>
                    <div className="alert">
                      <div className="alertTitle">Time</div>
                      <div className="muted">
                        {selectedStart}–{selectedEnd}
                      </div>
                    </div>
                  </div>

                  <div className="alert">
                    <div className="alertTitle">Duration</div>
                    <div className="muted">{selectedDuration} minutes</div>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="reason" className="label">
                  Booking Reason
                </label>
                <textarea
                  id="reason"
                  className="input"
                  style={{ minHeight: 100, fontFamily: 'monospace' }}
                  placeholder="Why do you need this facility?"
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  disabled={isSubmitting}
                />
                {!selectedReason.trim() && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Reason is required
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <button
              className="btn"
              onClick={goBack}
              disabled={currentStep === STEPS.FACILITY || isSubmitting}
            >
              ← Back
            </button>

            <button
              className="btn btnPrimary"
              onClick={() => {
                if (currentStep === STEPS.FACILITY) {
                  setCurrentStep(STEPS.SLOT)
                } else if (currentStep === STEPS.CONFIRM) {
                  handleSubmitBooking()
                }
              }}
              disabled={!canProceed() || isSubmitting || isLoadingAvailability}
            >
              {currentStep === STEPS.FACILITY && 'Next →'}
              {currentStep === STEPS.SLOT && (isLoadingAvailability ? 'Loading...' : 'Continue to Confirmation')}
              {currentStep === STEPS.CONFIRM && (isSubmitting ? 'Confirming...' : 'Confirm Booking')}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
