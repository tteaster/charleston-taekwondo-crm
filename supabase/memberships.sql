-- ============================================================
-- MEMBERSHIPS — run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE membership_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('afterschool', 'martial_arts', 'leadership')),
  frequency     TEXT,                          -- e.g. '1x/week', '2x/week'
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'biweekly', 'monthly')),
  price         NUMERIC(8,2) NOT NULL,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE student_memberships (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID REFERENCES students(id) NOT NULL,
  membership_type_id UUID REFERENCES membership_types(id) NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  start_date         DATE,
  end_date           DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER student_memberships_updated_at
  BEFORE UPDATE ON student_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE membership_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_memberships ENABLE ROW LEVEL SECURITY;

-- ── Seed data ────────────────────────────────────────────────────────────────
INSERT INTO membership_types (name, category, frequency, billing_cycle, price) VALUES
  -- After School
  ('Afterschool 2x/week',         'afterschool', '2x/week', 'weekly',    89.00),
  ('Afterschool 3x/week',         'afterschool', '3x/week', 'weekly',   109.00),
  ('Afterschool 5x/week',         'afterschool', '5x/week', 'weekly',   129.00),
  ('Afterschool Bi-weekly',       'afterschool', NULL,      'biweekly', 129.00),
  -- Tigers
  ('Tigers 1x/week',              'martial_arts', '1x/week', 'weekly',   30.00),
  ('Tigers 2x/week',              'martial_arts', '2x/week', 'weekly',   40.00),
  ('Tigers 1x/week Monthly',      'martial_arts', '1x/week', 'monthly', 130.00),
  ('Tigers 2x/week Monthly',      'martial_arts', '2x/week', 'monthly', 175.00),
  -- Kids
  ('Kids 1x/week',                'martial_arts', '1x/week', 'weekly',   30.00),
  ('Kids 2x/week',                'martial_arts', '2x/week', 'weekly',   40.00),
  ('Kids 1x/week Monthly',        'martial_arts', '1x/week', 'monthly', 130.00),
  ('Kids 2x/week Monthly',        'martial_arts', '2x/week', 'monthly', 175.00),
  -- Teen/Adult
  ('Teen/Adult 1x/week',          'martial_arts', '1x/week', 'weekly',   30.00),
  ('Teen/Adult 2x/week',          'martial_arts', '2x/week', 'weekly',   40.00),
  ('Teen/Adult 1x/week Monthly',  'martial_arts', '1x/week', 'monthly', 130.00),
  ('Teen/Adult 2x/week Monthly',  'martial_arts', '2x/week', 'monthly', 175.00),
  -- Leadership
  ('Leadership',                  'leadership', NULL, 'weekly',   50.00),
  ('Leadership Monthly',          'leadership', NULL, 'monthly', 220.00);
