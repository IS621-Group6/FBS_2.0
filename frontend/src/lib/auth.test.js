import { AUTH_STORAGE, clearStoredUser, getStoredUser, storeUser } from './auth'

describe('auth storage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('storeUser and getStoredUser roundtrip', () => {
    const stored = storeUser('test@test.com')
    expect(stored).toEqual({ email: 'test@test.com' })
    expect(getStoredUser()).toEqual({ email: 'test@test.com' })
  })

  test('clearStoredUser removes auth keys', () => {
    storeUser('test@test.com')
    clearStoredUser()

    expect(localStorage.getItem(AUTH_STORAGE.loggedInKey)).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE.emailKey)).toBeNull()
    expect(getStoredUser()).toBeNull()
  })

  test('blank email does not log in', () => {
    expect(storeUser('   ')).toBeNull()
    expect(getStoredUser()).toBeNull()
  })
})
