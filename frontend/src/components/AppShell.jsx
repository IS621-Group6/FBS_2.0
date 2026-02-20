import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function AppShell({ children, showSearch = true }) {
  const navigate = useNavigate()
  const q = useQuery().get('q') || ''
  const [query, setQuery] = useState(q)

  useEffect(() => {
    Promise.resolve().then(() => setQuery(q))
  }, [q])

  const onSubmit = (e) => {
    e.preventDefault()
    const sp = new URLSearchParams()
    if (query.trim()) sp.set('q', query.trim())
    navigate(`/?${sp.toString()}`)
  }

  return (
    <div className="appRoot">
      <header className="topNav">
        <div className="topNavInner">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(var(--primary-rgb), 0.12)',
                border: '1px solid rgba(var(--primary-rgb), 0.18)',
              }}
            />
            <div className="brand">
              <div className="brandTitle">SMU Facility Booking 2.0</div>
              <div className="brandSub">Search-first room booking</div>
            </div>
          </Link>

          <div className="navGrow">
            {showSearch ? (
              <form onSubmit={onSubmit} className="row" role="search" aria-label="Global search">
                <input
                  className="input"
                  style={{ maxWidth: 520 }}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by room name, building, or feature (e.g., 'seminar', 'projector')"
                />
                <button className="btn btnPrimary" type="submit">
                  Search
                </button>
              </form>
            ) : null}
          </div>

          <div className="navRight">
            <span className="pill" title="Authentication disabled">
              Guest mode
            </span>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
