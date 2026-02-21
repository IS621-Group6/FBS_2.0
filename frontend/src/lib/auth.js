export const AUTH_STORAGE = {
  loggedInKey: 'fbs_is_logged_in',
  tokenKey: 'fbs_auth_token',
  emailKey: 'fbs_user_email',
  usernameKey: 'fbs_user_username',
}

export function getStoredUser() {
  const isLoggedIn = localStorage.getItem(AUTH_STORAGE.loggedInKey) === 'true'
  const token = (localStorage.getItem(AUTH_STORAGE.tokenKey) || '').trim()
  const email = (localStorage.getItem(AUTH_STORAGE.emailKey) || '').trim()
  const username = (localStorage.getItem(AUTH_STORAGE.usernameKey) || '').trim()
  if (!isLoggedIn || !token || !email) return null
  return { token, email, username: username || email }
}

export function storeUser({ token, email, username }) {
  const normalizedToken = String(token || '').trim()
  const normalizedEmail = String(email || '').trim()
  const normalizedUsername = String(username || normalizedEmail).trim()

  if (!normalizedToken || !normalizedEmail) return null

  localStorage.setItem(AUTH_STORAGE.loggedInKey, 'true')
  localStorage.setItem(AUTH_STORAGE.tokenKey, normalizedToken)
  localStorage.setItem(AUTH_STORAGE.emailKey, normalizedEmail)
  localStorage.setItem(AUTH_STORAGE.usernameKey, normalizedUsername)
  return { token: normalizedToken, email: normalizedEmail, username: normalizedUsername }
}

export function clearStoredUser() {
  localStorage.removeItem(AUTH_STORAGE.loggedInKey)
  localStorage.removeItem(AUTH_STORAGE.tokenKey)
  localStorage.removeItem(AUTH_STORAGE.emailKey)
  localStorage.removeItem(AUTH_STORAGE.usernameKey)
}
