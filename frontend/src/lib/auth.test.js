import { AUTH_STORAGE, clearStoredUser, getStoredUser, storeUser } from './auth'

describe('auth storage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('storeUser and getStoredUser roundtrip', () => {
    const stored = storeUser({ email: 'marcus.goh@smu.edu.sg', token: 'token-123', role: 'staff' })
    expect(stored).toEqual({ email: 'marcus.goh@smu.edu.sg', token: 'token-123', role: 'staff' })
    expect(getStoredUser()).toEqual({ email: 'marcus.goh@smu.edu.sg', token: 'token-123', role: 'staff' })
  })

  test('clearStoredUser removes auth keys', () => {
    storeUser({ email: 'marcus.goh@smu.edu.sg', token: 'token-123', role: 'staff' })
    clearStoredUser()

    expect(localStorage.getItem(AUTH_STORAGE.loggedInKey)).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE.emailKey)).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE.tokenKey)).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE.roleKey)).toBeNull()
    expect(getStoredUser()).toBeNull()
  })

  test('blank email or token does not log in', () => {
    expect(storeUser({ email: '   ', token: 'token-123', role: 'student' })).toBeNull()
    expect(storeUser({ email: 'test@test.com', token: '   ', role: 'student' })).toBeNull()
    expect(getStoredUser()).toBeNull()
  })
})
