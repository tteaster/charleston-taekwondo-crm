import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [staff, setStaff] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  async function fetchStaff(email) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .ilike('email', email)
      .maybeSingle()

    if (error) console.error('[Auth] staff lookup error:', error.message)

    setStaff(data ?? null)
    setAuthLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchStaff(session.user.email)
      else setAuthLoading(false)
    })

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

  const role = staff?.role ?? null

  // admin: read-only access across all locations
  // office_manager / head_instructor: full CRUD within their location
  const isAdmin         = role === 'admin' || role === null
  const canEdit         = role === 'office_manager' || role === 'head_instructor'
  const scopedLocationId = canEdit ? (staff?.location_id ?? null) : null

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, staff, isAdmin, canEdit, scopedLocationId, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
