import { useState } from 'react'
import DashboardPage from './pages/DashboardPage'
import LeadsPipeline from './pages/LeadsPipeline'
import StudentsPage from './pages/StudentsPage'

const NAV = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'leads',     label: 'Leads Pipeline' },
  { key: 'students',  label: 'Students' },
]

const PAGES = {
  dashboard: <DashboardPage />,
  leads:     <LeadsPipeline />,
  students:  <StudentsPage />,
}

function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top nav */}
      <nav className="bg-indigo-700 text-white px-6 py-0 flex items-center gap-1 shrink-0 h-12">
        <div className="flex items-center gap-2 mr-6">
          <div className="w-7 h-7 bg-white/20 rounded flex items-center justify-center text-xs font-bold">
            CTK
          </div>
          <span className="font-semibold text-sm tracking-wide">Charleston Taekwondo</span>
        </div>
        {NAV.map(item => (
          <button
            key={item.key}
            onClick={() => setPage(item.key)}
            className={`px-4 h-12 text-sm font-medium transition-colors border-b-2 ${
              page === item.key
                ? 'border-white text-white'
                : 'border-transparent text-indigo-200 hover:text-white hover:border-indigo-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Page content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {PAGES[page]}
      </div>
    </div>
  )
}

export default App
