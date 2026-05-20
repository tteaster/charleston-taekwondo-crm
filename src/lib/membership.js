import { supabase } from './supabase'

/**
 * Recomputes and saves a student's `program` field based on their active memberships.
 *   afterschool only            → 'asp'
 *   martial_arts/leadership only → 'tkd'
 *   both                        → 'tkd_asp'
 *   none                        → null
 */
export async function syncStudentProgram(studentId) {
  const { data } = await supabase
    .from('student_memberships')
    .select('membership_types(category)')
    .eq('student_id', studentId)
    .eq('status', 'active')

  const cats = new Set(
    (data ?? []).map(m => m.membership_types?.category).filter(Boolean)
  )
  const hasAS = cats.has('afterschool')
  const hasMA = cats.has('martial_arts') || cats.has('leadership')

  let program = null
  if (hasAS && hasMA) program = 'tkd_asp'
  else if (hasAS)     program = 'asp'
  else if (hasMA)     program = 'tkd'

  const { error } = await supabase
    .from('students')
    .update({ program })
    .eq('id', studentId)

  if (error) console.error('[syncStudentProgram]', error.message)
  return program
}

/**
 * Checks whether a student can be enrolled in a given membership category.
 * Returns null if allowed, or an error string if blocked.
 */
export async function checkEnrollmentConflict(studentId, category) {
  const { data } = await supabase
    .from('student_memberships')
    .select('membership_types(category)')
    .eq('student_id', studentId)
    .eq('status', 'active')

  const activeCats = new Set(
    (data ?? []).map(m => m.membership_types?.category).filter(Boolean)
  )

  if (category === 'afterschool' && activeCats.has('afterschool')) {
    return 'This student already has an active afterschool membership.'
  }
  if (['martial_arts', 'leadership'].includes(category) &&
      (activeCats.has('martial_arts') || activeCats.has('leadership'))) {
    return 'This student already has an active martial arts or leadership membership.'
  }
  return null
}
