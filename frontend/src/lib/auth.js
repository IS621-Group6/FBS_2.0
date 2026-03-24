export const AUTH_STORAGE = {
  loggedInKey: 'fbs_is_logged_in',
  emailKey: 'fbs_user_email',
  tokenKey: 'fbs_access_token',
  nameKey: 'fbs_user_name',
  roleKey: 'fbs_user_role',
}

export function getStoredUser() {
  const isLoggedIn = localStorage.getItem(AUTH_STORAGE.loggedInKey) === 'true'
  const email = (localStorage.getItem(AUTH_STORAGE.emailKey) || '').trim()
  const token = (localStorage.getItem(AUTH_STORAGE.tokenKey) || '').trim()
  const name = (localStorage.getItem(AUTH_STORAGE.nameKey) || '').trim()
  const role = (localStorage.getItem(AUTH_STORAGE.roleKey) || '').trim()
  if (!isLoggedIn || !email || !token) return null
  return {
    email,
    token,
    ...(name ? { name } : {}),
    ...(role ? { role } : {}),
  }
}

export function storeUser(emailOrUser, token) {
  const user = typeof emailOrUser === 'object' && emailOrUser !== null
    ? emailOrUser
    : { email: emailOrUser, token }
  const normalized = String(user.email || '').trim()
  const normalizedToken = String(user.token || '').trim()
  const normalizedName = String(user.name || '').trim()
  const normalizedRole = String(user.role || '').trim().toLowerCase()
  if (!normalized || !normalizedToken) return null
  localStorage.setItem(AUTH_STORAGE.loggedInKey, 'true')
  localStorage.setItem(AUTH_STORAGE.emailKey, normalized)
  localStorage.setItem(AUTH_STORAGE.tokenKey, normalizedToken)
  if (normalizedName) {
    localStorage.setItem(AUTH_STORAGE.nameKey, normalizedName)
  } else {
    localStorage.removeItem(AUTH_STORAGE.nameKey)
  }
  if (normalizedRole) {
    localStorage.setItem(AUTH_STORAGE.roleKey, normalizedRole)
  } else {
    localStorage.removeItem(AUTH_STORAGE.roleKey)
  }
  return {
    email: normalized,
    token: normalizedToken,
    ...(normalizedName ? { name: normalizedName } : {}),
    ...(normalizedRole ? { role: normalizedRole } : {}),
  }
}

export function clearStoredUser() {
  localStorage.removeItem(AUTH_STORAGE.loggedInKey)
  localStorage.removeItem(AUTH_STORAGE.emailKey)
  localStorage.removeItem(AUTH_STORAGE.tokenKey)
  localStorage.removeItem(AUTH_STORAGE.nameKey)
  localStorage.removeItem(AUTH_STORAGE.roleKey)
}
