import { AUTH_STORAGE, clearStoredUser, getStoredUser, storeUser } from './auth'

describe('auth storage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('storeUser and getStoredUser roundtrip', () => {
    const stored = storeUser('test@test.com', 'token-123')
    expect(stored).toEqual({ email: 'test@test.com', token: 'token-123' })
    expect(getStoredUser()).toEqual({ email: 'test@test.com', token: 'token-123' })
  })

  test('clearStoredUser removes auth keys', () => {
    storeUser('test@test.com', 'token-123')
    clearStoredUser()

    expect(localStorage.getItem(AUTH_STORAGE.loggedInKey)).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE.emailKey)).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE.tokenKey)).toBeNull()
    expect(getStoredUser()).toBeNull()
  })

  test('blank email or token does not log in', () => {
    expect(storeUser('   ', 'token-123')).toBeNull()
    expect(storeUser('test@test.com', '   ')).toBeNull()
    expect(getStoredUser()).toBeNull()
  })
})
