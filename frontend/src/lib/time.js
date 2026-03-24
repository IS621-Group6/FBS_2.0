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
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value

  if (year && month && day) return `${year}-${month}-${day}`

  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function singaporeNowInfo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value)

  return {
    date: year && month && day ? `${year}-${month}-${day}` : isoToday(),
    minutes: Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0,
  }
}

export function isPastSingaporeDateTime(date, hhmm) {
  const startMinutes = parseTimeToMinutes(hhmm)
  if (!date || startMinutes === null) return false

  const now = singaporeNowInfo()
  if (date < now.date) return true
  if (date > now.date) return false
  return startMinutes < now.minutes
}
