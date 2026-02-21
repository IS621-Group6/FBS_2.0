import { useEffect, useMemo, useState } from 'react'
import AuthContext from './AuthContext'
import { clearStoredUser, getStoredUser, storeUser } from './auth'
import { logout as apiLogout } from './api'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())

  useEffect(() => {
    const onForcedLogout = () => {
      clearStoredUser()
      setUser(null)
    }
    window.addEventListener('fbs:logout', onForcedLogout)
    return () => window.removeEventListener('fbs:logout', onForcedLogout)
  }, [])

  const login = ({ token, user: userPayload }) => {
    const next = storeUser({
      token,
      email: userPayload?.email,
      username: userPayload?.username,
    })
    setUser(next)
    return next
  }

  const logout = () => {
    Promise.resolve()
      .then(() => apiLogout())
      .catch(() => {})
    clearStoredUser()
    setUser(null)
  }

  const value = useMemo(() => ({ user, login, logout }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
