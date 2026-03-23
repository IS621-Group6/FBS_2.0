import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('shows error for invalid credentials', async () => {
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
      json: async () => ({ token: 'token-123' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onLoginSuccess = vi.fn()
    render(<LoginPage onLoginSuccess={onLoginSuccess} />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledWith({ email: 'test@test.com', token: 'token-123' })
    })
  })
})
