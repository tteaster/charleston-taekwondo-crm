-- ============================================================
-- ATTENDANCE + GAMIFICATION — run this in Supabase SQL Editor
-- ============================================================

-- Add points column to existing attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 10;

-- Points log
CREATE TABLE points_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID REFERENCES students(id) NOT NULL,
  location_id  UUID REFERENCES locations(id),
  points       INTEGER NOT NULL,
  reason       TEXT NOT NULL CHECK (reason IN (
                 'attendance', 'referral', 'event',
                 'perfect_attendance', 'belt_promotion', 'manual_adjustment'
               )),
  reference_id UUID,          -- links to attendance.id or an event id
  notes        TEXT,
  awarded_at   TIMESTAMPTZ DEFAULT now(),
  awarded_by   UUID REFERENCES staff(id)
);

ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;

-- Index for fast leaderboard queries
CREATE INDEX points_log_student_awarded ON points_log (student_id, awarded_at);
CREATE INDEX points_log_location_awarded ON points_log (location_id, awarded_at);
