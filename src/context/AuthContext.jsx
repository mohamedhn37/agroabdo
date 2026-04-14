import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthChange, getOne, logoutUser, COLS } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // Firebase Auth user
  const [profile, setProfile] = useState(null)   // Firestore profil { nom, role, ... }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const prof = await getOne(COLS.users, firebaseUser.uid)

          // Security: if profile not found or account deactivated → log out immediately
          if (!prof || prof.actif === false) {
            await logoutUser()
            setUser(null)
            setProfile(null)
            setLoading(false)
            return
          }

          setUser(firebaseUser)
          setProfile(prof)
        } catch {
          // Firestore error — do NOT grant any role, log user out for safety
          await logoutUser()
          setUser(null)
          setProfile(null)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)