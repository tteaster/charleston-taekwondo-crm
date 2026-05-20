import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LeadsPipeline from './pages/LeadsPipeline'
import StudentsPage from './pages/StudentsPage'
import MembershipsPage from './pages/MembershipsPage'
import BillingPage from './pages/BillingPage'

const NAV = [
  { key: 'dashboard',   label: 'Dashboard' },
  { key: 'leads',       label: 'Leads Pipeline' },
  { key: 'students',    label: 'Students' },
  { key: 'memberships', label: 'Memberships' },
  { key: 'billing',     label: 'Billing' },
]

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const { session, staff, isAdmin, canEdit, scopedLocationId, authLoading, signOut } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (authLoading) return <Spinner />
  if (!session)    return <LoginPage />

  const displayName = staff?.name ?? session.user.email

  const pages = {
    dashboard:   <DashboardPage />,
    leads:       <LeadsPipeline />,
    students:    <StudentsPage />,
    memberships: <MembershipsPage />,
    billing:     <BillingPage />,
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top nav */}
      <nav className="bg-indigo-700 text-white px-4 flex items-center gap-1 shrink-0 h-12">
        {/* Brand */}
        <div className="flex items-center gap-2 mr-4 shrink-0">
          <div className="w-7 h-7 bg-white/20 rounded flex items-center justify-center text-xs font-bold">
            CTK
          </div>
          <span className="font-semibold text-sm tracking-wide hidden sm:block">Charleston Taekwondo</span>
        </div>

        {/* Nav links */}
        {NAV.map(item => (
          <button
            key={item.key}
            onClick={() => setPage(item.key)}
            className={`px-3 h-12 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              page === item.key
                ? 'border-white text-white'
                : 'border-transparent text-indigo-200 hover:text-white hover:border-indigo-400'
            }`}
          >
            {item.label}
          </button>
        ))}

        {/* Right side: user info + sign out */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          {isAdmin && !canEdit && (
            <span className="text-xs bg-amber-400/20 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded hidden sm:block">
              Read-only
            </span>
          )}
          {canEdit && staff?.location_id && (
            <span className="text-xs bg-white/15 text-indigo-100 px-2 py-0.5 rounded hidden sm:block">
              {staff.locations?.name ?? 'Scoped'}
            </span>
          )}
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-white leading-tight">{displayName}</p>
              {staff?.role && (
                <p className="text-xs text-indigo-300 leading-tight capitalize">{staff.role.replace('_', ' ')}</p>
              )}
            </div>
            <button
              onClick={signOut}
              className="text-xs text-indigo-200 hover:text-white border border-indigo-500 hover:border-indigo-300 px-2.5 py-1 rounded transition-colors whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Missing staff record warning */}
      {session && !staff && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-700 flex items-center gap-2">
          <span>⚠</span>
          <span>
            Your account (<strong>{session.user.email}</strong>) is not linked to a staff record.
            Ask an administrator to add you to the staff table.
          </span>
        </div>
      )}

      {/* Page content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {pages[page]}
      </div>
    </div>
  )
}
