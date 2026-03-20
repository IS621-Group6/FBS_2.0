import { expect, test } from '@playwright/test'

function isoDateOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function hhmm(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

test('backend rejects a second booking for the same slot', async ({ request }) => {
  const facilities = await request.get('http://127.0.0.1:3001/api/facilities?pageSize=1')
  expect(facilities.ok()).toBeTruthy()
  const facilityPayload = await facilities.json()
  const facilityId = facilityPayload.items[0].id
  const date = isoDateOffset(30)

  const availability = await request.get(`http://127.0.0.1:3001/api/facilities/${encodeURIComponent(facilityId)}/availability?date=${date}`)
  expect(availability.ok()).toBeTruthy()
  const booked = ((await availability.json()).reservations || []).map((r: { start: string; end: string }) => ({
    start: toMinutes(r.start),
    end: toMinutes(r.end),
  }))

  let start = '10:00'
  let end = '11:00'
  for (let t = 8 * 60; t + 60 <= 22 * 60; t += 30) {
    const candidateEnd = t + 60
    const conflict = booked.some((b: { start: number; end: number }) => t < b.end && candidateEnd > b.start)
    if (!conflict) {
      start = hhmm(t)
      end = hhmm(candidateEnd)
      break
    }
  }

  const payload = {
    facilityId,
    date,
    start,
    end,
    reason: 'E2E conflict test',
  }

  const first = await request.post('http://127.0.0.1:3001/api/bookings', {
    data: { ...payload, userEmail: 'e2e.first@smu.edu.sg' },
  })
  expect(first.status()).toBe(201)

  const second = await request.post('http://127.0.0.1:3001/api/bookings', {
    data: { ...payload, userEmail: 'e2e.second@smu.edu.sg' },
  })

  expect(second.status()).toBe(409)
  const body = await second.json()
  expect(body.error).toBe('DOUBLE_BOOKING')
})
