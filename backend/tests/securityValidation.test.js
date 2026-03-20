const request = require('supertest')
const app = require('../index')

function futureIso(days = 14) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function anyFacilityId() {
  const res = await request(app).get('/api/facilities').query({ pageSize: 1 })
  expect(res.status).toBe(200)
  return res.body.items[0].id
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function toHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}:${m}`
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

async function getFreeOneHourSlot(facilityId, date) {
  const availability = await request(app)
    .get(`/api/facilities/${encodeURIComponent(facilityId)}/availability`)
    .query({ date })

  expect(availability.status).toBe(200)
  const reservations = Array.isArray(availability.body.reservations) ? availability.body.reservations : []
  const booked = reservations
    .map((r) => ({ start: toMinutes(r.start), end: toMinutes(r.end) }))
    .filter((r) => r.start !== null && r.end !== null)

  for (let t = 8 * 60; t + 60 <= 22 * 60; t += 30) {
    const end = t + 60
    const conflict = booked.some((b) => overlaps(t, end, b.start, b.end))
    if (!conflict) return { start: toHHMM(t), end: toHHMM(end) }
  }

  throw new Error(`No free slot found for ${facilityId} on ${date}`)
}

describe('booking validation and auth negative paths', () => {
  test('create booking rejects missing fields', async () => {
    const res = await request(app).post('/api/bookings').send({ facilityId: 'R-1' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/missing required booking fields/i)
  })

  test('create booking rejects invalid date format', async () => {
    const facilityId = await anyFacilityId()
    const res = await request(app).post('/api/bookings').send({
      facilityId,
      date: '20-03-2026',
      start: '10:00',
      end: '11:00',
      userEmail: 'invalid.date@smu.edu.sg',
      reason: 'validation test',
    })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid date format/i)
  })

  test('modify booking forbids non-owner', async () => {
    const facilityId = await anyFacilityId()
    const date = futureIso(20)
    const slot = await getFreeOneHourSlot(facilityId, date)
    const create = await request(app).post('/api/bookings').send({
      facilityId,
      date,
      start: slot.start,
      end: slot.end,
      userEmail: 'owner.only@smu.edu.sg',
      reason: 'ownership test',
    })
    expect(create.status).toBe(201)

    const update = await request(app)
      .put(`/api/bookings/${create.body.id}`)
      .set('x-user-email', 'intruder@smu.edu.sg')
      .send({ date, start: slot.start, end: slot.end })

    expect(update.status).toBe(403)
    expect(update.body.message).toMatch(/unauthorised/i)
  })

  test('cancel booking requires logged-in user', async () => {
    const res = await request(app).delete('/api/bookings/B-999999')
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/please log in/i)
  })
})
