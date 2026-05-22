import { useState } from 'react'

// Temperature colours
const TEMP_DOT = {
  hot:  'bg-emerald-400',
  warm: 'bg-amber-400',
  cold: 'bg-blue-400',
}
const TEMP_TEXT_CLS = {
  hot:  'text-emerald-600',
  warm: 'text-amber-600',
  cold: 'text-blue-500',
}
const TEMP_BORDER = {
  hot:  '#34d399', // emerald-400
  warm: '#fbbf24', // amber-400
  cold: '#60a5fa', // blue-400
}

// ── Icon components ──────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
  )
}

function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>
  )
}

// ── Lead card ─────────────────────────────────────────────────────────────────

export default function LeadCard({ lead, onEdit }) {
  const [flash, setFlash] = useState(null) // 'sms' | 'email' | '?'

  const fullName  = `${lead.first_name} ${lead.last_name}`
  const daysSince = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000)
  const borderColor = TEMP_BORDER[lead.temperature] ?? '#e2e8f0'

  function logAction(type, e) {
    e.stopPropagation()
    if (type === 'sms')   console.log(`[Lead SMS]   ${fullName} | ${lead.phone}`)
    if (type === 'email') console.log(`[Lead Email] ${fullName} | ${lead.email}`)
    if (type === '?')     console.log(`[Lead Unqualified] ${fullName}`)
    setFlash(type)
    setTimeout(() => setFlash(null), 1400)
  }

  return (
    <div
      onClick={onEdit}
      style={{ borderLeft: `4px solid ${borderColor}` }}
      className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md transition-shadow select-none"
    >
      {/* Row 1: temperature + name + days */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {lead.temperature && (
          <span className="flex items-center gap-1 shrink-0">
            <span className={`w-2 h-2 rounded-full ${TEMP_DOT[lead.temperature]}`} />
            <span className={`text-xs font-bold uppercase tracking-wide ${TEMP_TEXT_CLS[lead.temperature]}`}>
              {lead.temperature}
            </span>
          </span>
        )}
        <p className="text-sm font-semibold text-slate-800 flex-1 truncate leading-tight">
          {fullName}
        </p>
        <span className="text-xs text-slate-400 shrink-0 font-mono">{daysSince}d</span>
      </div>

      {/* Row 2: phone */}
      {lead.phone && (
        <div className="flex items-center gap-1.5 mb-1 text-slate-500">
          <PhoneIcon />
          <span className="text-xs">{lead.phone}</span>
        </div>
      )}

      {/* Row 3: email */}
      {lead.email && (
        <div className="flex items-center gap-1.5 mb-2 text-slate-400">
          <MailIcon />
          <span className="text-xs truncate">{lead.email}</span>
        </div>
      )}

      {/* Row 4: quick-action buttons */}
      <div
        className="flex items-center gap-1.5 pt-2 border-t border-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Unqualified / unknown */}
        <button
          type="button"
          onClick={e => logAction('?', e)}
          title="Mark as unqualified"
          className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-medium transition-colors ${
            flash === '?'
              ? 'bg-slate-100 border-slate-300 text-slate-700'
              : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          ?
        </button>

        {/* SMS */}
        {lead.phone && (
          <button
            type="button"
            onClick={e => logAction('sms', e)}
            title={`SMS ${lead.phone}`}
            className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${
              flash === 'sms'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <PhoneIcon />
          </button>
        )}

        {/* Email */}
        {lead.email && (
          <button
            type="button"
            onClick={e => logAction('email', e)}
            title={`Email ${lead.email}`}
            className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${
              flash === 'email'
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <MailIcon />
          </button>
        )}

        {/* Brief confirmation flash */}
        {flash && (
          <span className="text-xs text-emerald-500 font-medium ml-0.5">✓</span>
        )}
      </div>
    </div>
  )
}
