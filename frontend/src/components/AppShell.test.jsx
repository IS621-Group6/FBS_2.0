import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppShell from './AppShell'
import AuthContext from '../lib/AuthContext'
import { storeUser, clearStoredUser } from '../lib/auth'

function renderShell(user) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, logout: vi.fn(), login: vi.fn() }}>
        <AppShell>
          <div>Child content</div>
        </AppShell>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('AppShell', () => {
  afterEach(() => {
    clearStoredUser()
    vi.unstubAllGlobals()
  })

  test('shows remaining credits under the signed-in student email', async () => {
    storeUser({ email: 'alicia.tan.2027@smu.edu.sg', token: 'token-123', role: 'student' })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        email: 'alicia.tan.2027@smu.edu.sg',
        role: 'student',
        creditsRemaining: 4400,
      }),
      headers: { get: () => 'application/json' },
    })
    vi.stubGlobal('fetch', fetchMock)

    renderShell({ email: 'alicia.tan.2027@smu.edu.sg', token: 'token-123', role: 'student' })

    await waitFor(() => {
      expect(screen.getByText('Credits remaining: 4400')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/me/credits', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer token-123',
      }),
    }))
  })
})