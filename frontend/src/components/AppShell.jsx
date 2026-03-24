import { Link, NavLink } from 'react-router-dom'
import useAuth from '../lib/useAuth'

export default function AppShell({ children }) {
  const { user, logout } = useAuth()

  return (
    <div className="appRoot">
      <header className="topNav">
        <div className="topNavInner">
          <Link to="/search" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <div
              style={{
                width: 45,
                height: 45,
                borderRadius: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-contrast)',
                background: 'color-mix(in srgb, var(--primary-contrast) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--primary-contrast) 22%, transparent)',
              }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 10.5L12 4l9 6.5" />
                <path d="M5 10v10h14V10" />
                <path d="M9 20v-6h6v6" />
              </svg>
            </div>
            <div className="brand">
              <div className="brandTitle">SMU Facility booking 2.0</div>
            </div>
          </Link>

          <div className="navGrow" />

          <div className="navRight">
            <span className="navEmail">{user?.email || 'Signed out'}</span>
            <button className="btn btnDanger" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="primaryTabsBar" aria-label="Primary navigation">
        <div className="primaryTabsInner">
          <NavLink to="/search" className={({ isActive }) => `primaryTab ${isActive ? 'primaryTabActive' : ''}`}>
            Available rooms
          </NavLink>
          <NavLink to="/bookings" className={({ isActive }) => `primaryTab ${isActive ? 'primaryTabActive' : ''}`}>
            View bookings
          </NavLink>
        </div>
      </div>

      <main>{children}</main>
    </div>
  )
}
