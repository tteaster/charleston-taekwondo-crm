import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const SOURCE_COLORS = {
  walk_in: 'bg-teal-100 text-teal-700', website: 'bg-blue-100 text-blue-700',
  facebook_ad: 'bg-indigo-100 text-indigo-700', instagram_ad: 'bg-pink-100 text-pink-700',
  referral: 'bg-purple-100 text-purple-700', other: 'bg-slate-100 text-slate-600',
}
const SOURCE_LABELS = {
  walk_in: 'Walk-in', website: 'Website', facebook_ad: 'FB Ad',
  instagram_ad: 'IG Ad', referral: 'Referral', other: 'Other',
}

const TEMP_CLS = {
  hot:  'bg-emerald-100 text-emerald-700',
  warm: 'bg-amber-100 text-amber-700',
  cold: 'bg-blue-100 text-blue-700',
}
const TEMP_LABELS = { hot: '🔥 Hot', warm: '☀️ Warm', cold: '❄️ Cold' }

export default function LeadCard({ lead, statuses, onEdit, onStatusChange, onConvert }) {
  const { canEdit } = useAuth()
  const [quickAction, setQuickAction] = useState(null) // 'sms' | 'email' | null

  const fullName   = `${lead.first_name} ${lead.last_name}`
  const daysSince  = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000)

  function logSMS(e) {
    e.stopPropagation()
    console.log(`[Lead SMS] ${fullName} | ${lead.phone}`)
    setQuickAction('sms')
    setTimeout(() => setQuickAction(null), 1500)
  }

  function logEmail(e) {
    e.stopPropagation()
    console.log(`[Lead Email] ${fullName} | ${lead.email}`)
    setQuickAction('email')
    setTimeout(() => setQuickAction(null), 1500)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 hover:shadow-md transition-shadow select-none">
      {/* Name row */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1 min-w-0 mr-2">
          <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{fullName}</p>
          {lead.child_name && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {lead.child_name}{lead.child_age ? `, age ${lead.child_age}` : ''}
            </p>
          )}
        </div>
        {lead.source && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${SOURCE_COLORS[lead.source] ?? SOURCE_COLORS.other}`}>
            {SOURCE_LABELS[lead.source] ?? lead.source}
          </span>
        )}
      </div>

      {lead.phone && <p className="text-xs text-slate-500 mb-0.5">{lead.phone}</p>}
      {lead.locations?.name && <p className="text-xs text-slate-400 mb-1">{lead.locations.name}</p>}
      {lead.next_followup_at && (
        <p className="text-xs text-amber-600 mb-1">
          Follow-up: {new Date(lead.next_followup_at).toLocaleDateString()}
        </p>
      )}

      {/* Meta: days + temperature */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
          {daysSince}d
        </span>
        {lead.temperature && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TEMP_CLS[lead.temperature]}`}>
            {TEMP_LABELS[lead.temperature]}
          </span>
        )}
      </div>

      {/* Quick actions: SMS / Email */}
      {(lead.phone || lead.email) && (
        <div className="flex items-center gap-1.5 mb-2">
          {lead.phone && (
            <button
              type="button"
              onClick={logSMS}
              title={`SMS ${lead.phone}`}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                quickAction === 'sms'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {quickAction === 'sms' ? '✓ SMS' : '📱 SMS'}
            </button>
          )}
          {lead.email && (
            <button
              type="button"
              onClick={logEmail}
              title={`Email ${lead.email}`}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                quickAction === 'email'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {quickAction === 'email' ? '✓ Emailed' : '✉️ Email'}
            </button>
          )}
        </div>
      )}

      {/* Candit actions: status dropdown, Edit, Convert */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
          <select
            value={lead.status}
            onChange={e => onStatusChange(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="text-xs border border-slate-200 rounded px-1.5 py-1 flex-1 bg-white min-w-0 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button
            onClick={onEdit}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0"
          >
            Edit
          </button>
          {lead.status !== 'converted' && onConvert && (
            <button
              onClick={e => { e.stopPropagation(); onConvert() }}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium shrink-0"
              title="Convert to student"
            >
              Convert →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
