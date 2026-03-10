export default function BookingProgressBar({ currentStep, onStepClick }) {
  const steps = [
    { number: 1, label: 'Select Facility' },
    { number: 2, label: 'Choose Date & Time' },
    { number: 3, label: 'Confirm Booking' },
  ]

  const handleStepClick = (stepNumber) => {
    if (stepNumber < currentStep && onStepClick) {
      onStepClick(stepNumber)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        backgroundColor: 'white',
        padding: '20px 16px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        width: 'calc(50% - 32px)',
        minWidth: '280px',
        maxWidth: '600px',
      }}
    >
      <div style={{ gap: 24, display: 'flex', flexDirection: 'column' }}>
        {/* Progress Bar with Steps */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          {/* Background connecting lines */}
          <svg
            style={{
              position: 'absolute',
              top: 24,
              left: 0,
              right: 0,
              height: 3,
              width: '100%',
            }}
            preserveAspectRatio="none"
          >
            <line
              x1="0%"
              y1="50%"
              x2="100%"
              y2="50%"
              stroke="#d1d5db"
              strokeWidth="3"
            />
          </svg>

          {/* Completed line overlay */}
          {currentStep > 1 && (
            <svg
              style={{
                position: 'absolute',
                top: 24,
                left: 0,
                right: 0,
                height: 3,
                width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
              }}
              preserveAspectRatio="none"
            >
              <line
                x1="0%"
                y1="50%"
                x2="100%"
                y2="50%"
                stroke="#1f2937"
                strokeWidth="3"
              />
            </svg>
          )}

          {/* Steps */}
          {steps.map((step) => (
            <div
              key={step.number}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                position: 'relative',
                zIndex: 10,
                cursor: step.number < currentStep ? 'pointer' : 'default',
              }}
              onClick={() => handleStepClick(step.number)}
            >
              {/* Circle */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: step.number <= currentStep ? (step.number < currentStep ? '#1f2937' : '#2563eb') : '#d1d5db',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: step.number === currentStep ? 'bold' : 'normal',
                  fontSize: 20,
                  flexShrink: 0,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  transform: step.number < currentStep ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: step.number < currentStep ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
                }}
              >
                {step.number < currentStep ? '✓' : step.number}
              </div>

              {/* Step Label */}
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: step.number === currentStep ? 'bold' : 'normal',
                  color:
                    step.number < currentStep
                      ? '#1f2937' // Completed - Black
                      : step.number === currentStep
                        ? '#2563eb' // Current - Blue
                        : '#9ca3af', // Uncompleted - Grey
                }}
              >
                {step.label}
              </div>
            </div>
          ))}
        </div>

        {/* Step Counter */}
        <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
          Step {currentStep} of {steps.length}
        </div>
      </div>
    </div>
  )
}
