import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [staff, setStaff] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  async function fetchStaff(email) {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    setStaff(data ?? null)
    setAuthLoading(false)
  }

  useEffect(() => {
    // Resolve current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchStaff(session.user.email)
      else setAuthLoading(false)
    })

    // React to sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setSession(session)
        fetchStaff(session.user.email)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setStaff(null)
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = !staff || ['owner', 'admin'].includes(staff.role)
  const scopedLocationId = isAdmin ? null : (staff?.location_id ?? null)

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, staff, isAdmin, scopedLocationId, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
