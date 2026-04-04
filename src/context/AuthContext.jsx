import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthChange, getOne, COLS } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // Firebase Auth user
  const [profile, setProfile] = useState(null)   // Firestore profil { nom, role, ... }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Charger le profil Firestore
        try {
          const prof = await getOne(COLS.users, firebaseUser.uid)
          setProfile(prof)
        } catch {
          setProfile({ role: 'admin', nom: 'Admin', email: firebaseUser.email })
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