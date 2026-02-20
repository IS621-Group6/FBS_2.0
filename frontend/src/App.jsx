import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import SearchPage from './routes/SearchPage'
import FacilityDetailPage from './routes/FacilityDetailPage'
import FacilityCalendarPage from './routes/FacilityCalendarPage'
import BookingConfirmPage from './routes/BookingConfirmPage'
import BookingResultPage from './routes/BookingResultPage'
import ErrorPage from './routes/ErrorPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/facility/:id" element={<FacilityDetailPage />} />
      <Route path="/facility/:id/calendar" element={<FacilityCalendarPage />} />
      <Route path="/booking/confirm" element={<BookingConfirmPage />} />
      <Route path="/booking/success" element={<BookingResultPage variant="success" />} />
      <Route path="/booking/failure" element={<BookingResultPage variant="failure" />} />

      <Route path="/error" element={<ErrorPage />} />

      <Route path="*" element={<Navigate to="/error?code=404" replace />} />
    </Routes>
  )
}
