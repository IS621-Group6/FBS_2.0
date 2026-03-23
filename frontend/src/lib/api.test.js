import { createBooking, getBookings } from './api'
import { clearStoredUser, storeUser } from './auth'

describe('api request helpers', () => {
  beforeEach(() => {
    clearStoredUser()
  })

  test('createBooking sends json body and method', async () => {
    storeUser('test@test.com', 'token-123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ id: 'B-1' }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    await createBooking({ facilityId: 'R-1', date: '2026-03-20', start: '10:00', end: '11:00' })

    expect(fetchMock).toHaveBeenCalledWith('/api/bookings', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json', Authorization: 'Bearer token-123' }),
    }))

    vi.unstubAllGlobals()
  })

  test('getBookings includes bearer token header', async () => {
    storeUser('student@smu.edu.sg', 'token-abc')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ items: [] }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    await getBookings()

    expect(fetchMock).toHaveBeenCalledWith('/api/bookings', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
    }))

    vi.unstubAllGlobals()
  })

  test('throws error with status and message for failed responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Missing required booking fields' }),
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(createBooking({})).rejects.toMatchObject({
      message: 'Missing required booking fields',
      status: 400,
    })

    vi.unstubAllGlobals()
  })
})
