const SOURCE_COLORS = {
  walk_in: 'bg-teal-100 text-teal-700',
  website: 'bg-blue-100 text-blue-700',
  facebook_ad: 'bg-indigo-100 text-indigo-700',
  instagram_ad: 'bg-pink-100 text-pink-700',
  referral: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-600',
}

const SOURCE_LABELS = {
  walk_in: 'Walk-in',
  website: 'Website',
  facebook_ad: 'FB Ad',
  instagram_ad: 'IG Ad',
  referral: 'Referral',
  other: 'Other',
}

export default function LeadCard({ lead, statuses, onEdit, onStatusChange }) {
  const fullName = `${lead.first_name} ${lead.last_name}`

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 hover:shadow-md transition-shadow">
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

      {lead.phone && (
        <p className="text-xs text-slate-500 mb-0.5">{lead.phone}</p>
      )}
      {lead.locations?.name && (
        <p className="text-xs text-slate-400 mb-2">{lead.locations.name}</p>
      )}
      {lead.next_followup_at && (
        <p className="text-xs text-amber-600 mb-2">
          Follow-up: {new Date(lead.next_followup_at).toLocaleDateString()}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
        <select
          value={lead.status}
          onChange={e => onStatusChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          className="text-xs border border-slate-200 rounded px-1.5 py-1 flex-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {statuses.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={onEdit}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
