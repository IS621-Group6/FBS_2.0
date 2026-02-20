async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null)

  if (!res.ok) {
    const message = payload?.message || payload?.error || `Request failed (${res.status})`
    const err = new Error(message)
    err.status = res.status
    err.payload = payload
    throw err
  }

  return payload
}

export function getHealth() {
  return request('/api/health')
}

export function searchFacilities(params) {
  const sp = new URLSearchParams()

  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      sp.set(key, value.join(','))
      continue
    }
    sp.set(key, String(value))
  }

  const qs = sp.toString()
  return request(`/api/facilities${qs ? `?${qs}` : ''}`)
}

export function getFacility(id) {
  return request(`/api/facilities/${encodeURIComponent(id)}`)
}

export function getAvailability(facilityId, date) {
  const sp = new URLSearchParams()
  if (date) sp.set('date', date)
  return request(`/api/facilities/${encodeURIComponent(facilityId)}/availability?${sp.toString()}`)
}

export function createBooking(payload) {
  return request('/api/bookings', { method: 'POST', body: payload })
}

export function getAvailabilityGlimpse({ ids, date, start, duration, limit = 3 }) {
  const sp = new URLSearchParams()
  if (ids?.length) sp.set('ids', ids.join(','))
  if (date) sp.set('date', date)
  if (start) sp.set('start', start)
  if (duration) sp.set('duration', String(duration))
  if (limit) sp.set('limit', String(limit))
  return request(`/api/availability-glimpse?${sp.toString()}`)
}
