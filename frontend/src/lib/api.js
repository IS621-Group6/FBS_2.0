import { getAuthHeaders } from './auth'

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

function buildUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
}

async function request(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(buildUrl(path), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...getAuthHeaders(),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const contentType = res.headers?.get?.('content-type') || ''
  const isJson = contentType.includes('application/json') || typeof res.json === 'function'
  const payload = isJson
    ? await res.json().catch(() => null)
    : typeof res.text === 'function'
      ? await res.text().catch(() => null)
      : null

  if (!res.ok) {
    const message = payload?.message || payload?.error || `Request failed (${res.status})`
    const err = new Error(message)
    err.status = res.status
    err.data = payload
    throw err
  }

  return payload
}

export function getHealth() {
  return request('/api/health')
}

export function getFilters() {
  return request('/api/filters')
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

export function loginUser(payload) {
  return request('/api/login', { method: 'POST', body: payload }).catch((err) => {
    if (err && typeof err === 'object' && ('status' in err || 'data' in err)) {
      const message = err.message && !String(err.message).startsWith('Request failed')
        ? err.message
        : 'Invalid email or password.'
      throw Object.assign(new Error(message), {
        status: err.status,
        data: err.data,
      })
    }

    throw err
  })
}

export function getBookings() {
  return request('/api/bookings')
}

export function getMyCredits() {
  return request('/api/me/credits')
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

export function cancelBooking(id) {
  return request(`/api/bookings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function modifyBooking(id, payload) {
  return request(`/api/bookings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  })
}
