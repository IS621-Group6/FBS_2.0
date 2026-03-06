import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import LoginPage from './routes/LoginPage'
import SearchPage from './routes/SearchPage'
import FacilityDetailPage from './routes/FacilityDetailPage'
import FacilityCalendarPage from './routes/FacilityCalendarPage'
import BookingConfirmPage from './routes/BookingConfirmPage'
import BookingResultPage from './routes/BookingResultPage'
import ViewBookingsPage from './routes/ViewBookingsPage'
import BookingPage from './routes/BookingPage'
import AuthProvider from './lib/AuthProvider'
import useAuth from './lib/useAuth'

export default function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  )
}

function AuthedApp() {
  const { user, login } = useAuth()

  if (!user) {
    return <LoginPage onLoginSuccess={({ email }) => login(email)} />
  }

  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/booking/new" element={<BookingPage />} />
      <Route path="/facility/:id" element={<FacilityDetailPage />} />
      <Route path="/facility/:id/calendar" element={<FacilityCalendarPage />} />
      <Route path="/booking/confirm" element={<BookingConfirmPage />} />
      <Route path="/booking/success" element={<BookingResultPage variant="success" />} />
      <Route path="/booking/failure" element={<BookingResultPage variant="failure" />} />
      <Route path="/bookings" element={<ViewBookingsPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
