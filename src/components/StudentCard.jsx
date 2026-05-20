import { useAuth } from '../contexts/AuthContext'

const STATUS_STYLES = {
  trial:     'bg-amber-100 text-amber-700',
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-100 text-rose-700',
}

const STATUS_LABELS = {
  trial: 'Trial', active: 'Active', paused: 'Paused', cancelled: 'Cancelled',
}

const BELT_STYLES = {
  white:  'bg-gray-50 text-gray-600 border border-gray-300',
  yellow: 'bg-yellow-100 text-yellow-700',
  orange: 'bg-orange-100 text-orange-700',
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  red:    'bg-red-100 text-red-700',
  black:  'bg-gray-900 text-white',
}

const PROGRAM_LABELS = { tkd: 'TKD', asp: 'ASP', tkd_asp: 'TKD + ASP' }

function Stripes({ count }) {
  return (
    <span className="flex gap-0.5 items-center ml-1">
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          className={`inline-block w-1.5 h-3 rounded-sm ${i < count ? 'bg-current opacity-70' : 'bg-current opacity-15'}`}
        />
      ))}
    </span>
  )
}

export default function StudentCard({ student, onEdit, onProfile }) {
  const { canEdit } = useAuth()
  const fullName   = `${student.student_first_name} ${student.student_last_name}`
  const parentName = `${student.parent_first_name} ${student.parent_last_name}`
  const belt   = student.belt_rank
  const stripes = student.stripe_count ?? 0

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow ${onProfile ? 'cursor-pointer' : ''}`}
      onClick={onProfile ?? undefined}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-3">
          <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{fullName}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">Parent: {parentName}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[student.status] ?? STATUS_STYLES.trial}`}>
          {STATUS_LABELS[student.status] ?? student.status}
        </span>
      </div>

      {student.parent_phone && (
        <p className="text-xs text-slate-500 mb-1">{student.parent_phone}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
        {student.locations?.name && (
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
            {student.locations.name}
          </span>
        )}
        {student.program && (
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-medium">
            {PROGRAM_LABELS[student.program] ?? student.program}
          </span>
        )}
        {belt && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium flex items-center ${BELT_STYLES[belt] ?? BELT_STYLES.white}`}>
            {belt.charAt(0).toUpperCase() + belt.slice(1)}
            {stripes > 0 && <Stripes count={stripes} />}
          </span>
        )}
      </div>

      {student.enrollment_date && (
        <p className="text-xs text-slate-400 mb-2">
          Enrolled: {new Date(student.enrollment_date).toLocaleDateString()}
        </p>
      )}

      <div className="pt-2 border-t border-slate-100 flex justify-end min-h-[1.5rem]">
        {canEdit && (
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  )
}
