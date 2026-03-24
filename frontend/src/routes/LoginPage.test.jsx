import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('shows lockout message and disables submit after too many failed attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: 'LOGIN_LOCKED',
        message: 'Account locked after too many failed attempts. Please try again in 15 minutes.',
        retryAfterSeconds: 900,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<LoginPage onLoginSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@test.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Account locked after too many failed attempts.')
    })

    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  test('shows error for invalid credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Invalid email or password.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<LoginPage onLoginSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@test.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
    })
  })

  test('falls back to invalid credentials message when backend returns no message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<LoginPage onLoginSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@test.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
    })
  })

  test('calls onLoginSuccess for valid credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ email: 'marcus.goh@smu.edu.sg', token: 'token-123', role: 'staff' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onLoginSuccess = vi.fn()
    render(<LoginPage onLoginSuccess={onLoginSuccess} />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'marcus.goh@smu.edu.sg' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledWith({ email: 'marcus.goh@smu.edu.sg', token: 'token-123', role: 'staff' })
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/login', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
  })
})
