export const AUTH_STORAGE = {
  loggedInKey: 'fbs_is_logged_in',
  emailKey: 'fbs_user_email',
}

export function getStoredUser() {
  const isLoggedIn = localStorage.getItem(AUTH_STORAGE.loggedInKey) === 'true'
  const email = (localStorage.getItem(AUTH_STORAGE.emailKey) || '').trim()
  if (!isLoggedIn || !email) return null
  return { email }
}

export function storeUser(email) {
  const normalized = String(email || '').trim()
  if (!normalized) return null
  localStorage.setItem(AUTH_STORAGE.loggedInKey, 'true')
  localStorage.setItem(AUTH_STORAGE.emailKey, normalized)
  return { email: normalized }
}

export function clearStoredUser() {
  localStorage.removeItem(AUTH_STORAGE.loggedInKey)
  localStorage.removeItem(AUTH_STORAGE.emailKey)
}
