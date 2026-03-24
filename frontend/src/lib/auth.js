export const AUTH_STORAGE = {
  loggedInKey: 'fbs_is_logged_in',
  emailKey: 'fbs_user_email',
  tokenKey: 'fbs_access_token',
  roleKey: 'fbs_user_role',
}

export function getStoredUser() {
  const isLoggedIn = localStorage.getItem(AUTH_STORAGE.loggedInKey) === 'true'
  const email = (localStorage.getItem(AUTH_STORAGE.emailKey) || '').trim()
  const token = (localStorage.getItem(AUTH_STORAGE.tokenKey) || '').trim()
  const role = (localStorage.getItem(AUTH_STORAGE.roleKey) || '').trim()
  if (!isLoggedIn || !email || !token) return null
  return role ? { email, token, role } : { email, token }
}

export function storeUser(userOrEmail, tokenArg, roleArg) {
  const candidate = typeof userOrEmail === 'object' && userOrEmail !== null
    ? userOrEmail
    : { email: userOrEmail, token: tokenArg, role: roleArg }

  const normalized = String(candidate.email || '').trim()
  const normalizedToken = String(candidate.token || '').trim()
  const normalizedRole = String(candidate.role || '').trim().toLowerCase()
  if (!normalized || !normalizedToken) return null
  localStorage.setItem(AUTH_STORAGE.loggedInKey, 'true')
  localStorage.setItem(AUTH_STORAGE.emailKey, normalized)
  localStorage.setItem(AUTH_STORAGE.tokenKey, normalizedToken)
  if (normalizedRole) {
    localStorage.setItem(AUTH_STORAGE.roleKey, normalizedRole)
  } else {
    localStorage.removeItem(AUTH_STORAGE.roleKey)
  }
  return normalizedRole ? { email: normalized, token: normalizedToken, role: normalizedRole } : { email: normalized, token: normalizedToken }
}

export function clearStoredUser() {
  localStorage.removeItem(AUTH_STORAGE.loggedInKey)
  localStorage.removeItem(AUTH_STORAGE.emailKey)
  localStorage.removeItem(AUTH_STORAGE.tokenKey)
  localStorage.removeItem(AUTH_STORAGE.roleKey)
}
