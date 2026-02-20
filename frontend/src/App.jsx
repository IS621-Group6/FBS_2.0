import { useState, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import LoginPage from './routes/LoginPage'
import SearchPage from './routes/SearchPage'
import FacilityDetailPage from './routes/FacilityDetailPage'
import FacilityCalendarPage from './routes/FacilityCalendarPage'
import BookingConfirmPage from './routes/BookingConfirmPage'
import BookingResultPage from './routes/BookingResultPage'

export default function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('fbs_is_logged_in') === 'true'
    const userEmail = localStorage.getItem('fbs_user_email')
    if (isLoggedIn && userEmail) {
      setUser({ email: userEmail })
    }
    setIsLoading(false)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('fbs_is_logged_in')
    localStorage.removeItem('fbs_user_email')
    setUser(null)
  }

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  }

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />
  }

  return (
    <div>
      <div style={{
        padding: '12px 24px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #d4d4d4',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        color: '#6b6b6b'
      }}>
        <span>{user.email}</span>
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#0a0a0a',
            backgroundColor: 'transparent',
            border: '1px solid #d4d4d4',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#e5e5e5'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          Logout
        </button>
      </div>

      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/facility/:id" element={<FacilityDetailPage />} />
        <Route path="/facility/:id/calendar" element={<FacilityCalendarPage />} />
        <Route path="/booking/confirm" element={<BookingConfirmPage />} />
        <Route path="/booking/success" element={<BookingResultPage variant="success" />} />
        <Route path="/booking/failure" element={<BookingResultPage variant="failure" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
