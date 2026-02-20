import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { isoToday } from '../lib/time'

const CAMPUSES = ['Main Campus', 'Downtown Campus', 'Law Campus', 'Innovation District']
const EQUIPMENT = ['Projector', 'Whiteboard', 'Video Conferencing', 'Microphone', 'PC Lab']

export default function DashboardPage() {
  const navigate = useNavigate()

  const [q, setQ] = useState('')
  const [campus, setCampus] = useState('')
  const [minCapacity, setMinCapacity] = useState('')
  const [date, setDate] = useState(isoToday())
  const [start, setStart] = useState('10:00')
  const [duration, setDuration] = useState('60')
  const [equipment, setEquipment] = useState([])

  const end = useMemo(() => {
    const [h, m] = start.split(':').map(Number)
    const startMin = h * 60 + m
    const endMin = startMin + Number(duration)
    const hh = String(Math.floor(endMin / 60)).padStart(2, '0')
    const mm = String(endMin % 60).padStart(2, '0')
    return `${hh}:${mm}`
  }, [start, duration])

  const toggleEquipment = (eq) => {
    setEquipment((prev) => (prev.includes(eq) ? prev.filter((x) => x !== eq) : [...prev, eq]))
  }

  const onSearch = (e) => {
    e.preventDefault()
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    if (campus) sp.set('campus', campus)
    if (minCapacity) sp.set('minCapacity', minCapacity)
    if (date) sp.set('date', date)
    if (start) sp.set('start', start)
    if (end) sp.set('end', end)
    if (equipment.length) sp.set('equipment', equipment.join(','))
    sp.set('page', '1')
    navigate(`/search?${sp.toString()}`)
  }

  return (
    <AppShell>
      <div className="container">
        <div className="stack">
          <div className="stack" style={{ gap: 6 }}>
            <h1 className="h1">Find and book a room</h1>
            <div className="muted">
              Start with a keyword, then refine with filters. Designed for speed and clarity.
            </div>
          </div>

          <div className="card cardPad">
            <form className="stack" onSubmit={onSearch}>
              <div className="grid2">
                <div className="field">
                  <div className="label">Search</div>
                  <input
                    className="input"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="e.g., seminar room, study, LKS, projector"
                  />
                </div>

                <div className="field">
                  <div className="label">Campus</div>
                  <select className="select" value={campus} onChange={(e) => setCampus(e.target.value)}>
                    <option value="">Any campus</option>
                    {CAMPUSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <div className="label">Capacity</div>
                  <input
                    className="input"
                    value={minCapacity}
                    onChange={(e) => setMinCapacity(e.target.value.replace(/[^0-9]/g, ''))}
                    inputMode="numeric"
                    placeholder="Minimum seats"
                  />
                </div>

                <div className="field">
                  <div className="label">Date</div>
                  <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <div className="field">
                  <div className="label">Start time</div>
                  <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>

                <div className="field">
                  <div className="label">Duration</div>
                  <select className="select" value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                    <option value="150">2.5 hours</option>
                    <option value="180">3 hours</option>
                  </select>
                </div>
              </div>

              <div className="divider" />

              <div className="stack" style={{ gap: 10 }}>
                <div className="label">Equipment</div>
                <div className="row">
                  {EQUIPMENT.map((eq) => (
                    <label key={eq} className="pill" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={equipment.includes(eq)}
                        onChange={() => toggleEquipment(eq)}
                      />
                      {eq}
                    </label>
                  ))}
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="muted2" style={{ fontSize: 12 }}>
                    You’ll see only rooms that match your filters; availability is checked in the calendar.
                  </div>
                  <button className="btn btnPrimary" type="submit">
                    Search rooms
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
