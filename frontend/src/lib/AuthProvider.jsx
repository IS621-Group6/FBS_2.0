import { useMemo, useState, useCallback } from 'react'
import AuthContext from './AuthContext'
import { clearStoredUser, getStoredUser, storeUser } from './auth'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())

  const login = useCallback((email) => {
    const next = storeUser(email)
    setUser(next)
    return next
  }, [])

  const logout = useCallback(() => {
    clearStoredUser()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
