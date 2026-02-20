export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function formatTimeLabel(minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60)
  const m = minutesFromMidnight % 60
  return `${pad2(h)}:${pad2(m)}`
}

export function parseTimeToMinutes(hhmm) {
  if (!hhmm) return null
  const [h, m] = String(hhmm).split(':').map((x) => Number(x))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

export function isoToday() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = pad2(now.getMonth() + 1)
  const dd = pad2(now.getDate())
  return `${yyyy}-${mm}-${dd}`
}
