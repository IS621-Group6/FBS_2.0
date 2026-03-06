export default function BookingProgressBar({ currentStep }) {
  const steps = [
    { number: 1, label: 'Select Facility' },
    { number: 2, label: 'Choose Date & Time' },
    { number: 3, label: 'Confirm Booking' },
  ]

  return (
    <div className="stack" style={{ gap: 16, marginBottom: 24 }}>
      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {steps.map((step, idx) => (
          <div key={step.number} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: step.number <= currentStep ? '#2563eb' : '#e5e7eb',
                color: step.number <= currentStep ? 'white' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 14,
              }}
            >
              {step.number <= currentStep ? '✓' : step.number}
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  height: 2,
                  backgroundColor: step.number < currentStep ? '#2563eb' : '#e5e7eb',
                  flex: 1,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Label */}
      <div>
        <div className="h3" style={{ marginBottom: 4 }}>
          {steps[currentStep - 1]?.label}
        </div>
        <div className="muted">
          Step {currentStep} of {steps.length}
        </div>
      </div>
    </div>
  )
}
