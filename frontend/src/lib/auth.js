export const AUTH_STORAGE = {
  loggedInKey: 'fbs_is_logged_in',
  emailKey: 'fbs_user_email',
  tokenKey: 'fbs_access_token',
}

export function getStoredUser() {
  const isLoggedIn = localStorage.getItem(AUTH_STORAGE.loggedInKey) === 'true'
  const email = (localStorage.getItem(AUTH_STORAGE.emailKey) || '').trim()
  const token = (localStorage.getItem(AUTH_STORAGE.tokenKey) || '').trim()
  if (!isLoggedIn || !email || !token) return null
  return { email, token }
}

export function storeUser(email, token) {
  const normalized = String(email || '').trim()
  const normalizedToken = String(token || '').trim()
  if (!normalized || !normalizedToken) return null
  localStorage.setItem(AUTH_STORAGE.loggedInKey, 'true')
  localStorage.setItem(AUTH_STORAGE.emailKey, normalized)
  localStorage.setItem(AUTH_STORAGE.tokenKey, normalizedToken)
  return { email: normalized, token: normalizedToken }
}

export function clearStoredUser() {
  localStorage.removeItem(AUTH_STORAGE.loggedInKey)
  localStorage.removeItem(AUTH_STORAGE.emailKey)
  localStorage.removeItem(AUTH_STORAGE.tokenKey)
}
