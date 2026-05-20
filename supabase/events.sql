-- ============================================================
-- EVENTS — run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE event_series (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN (
                'belt_testing', 'parents_night_out', 'summer_camp', 'day_camp', 'skills_camp'
              )),
  eligibility TEXT NOT NULL DEFAULT 'open' CHECK (eligibility IN ('students_only', 'open')),
  price       NUMERIC(8,2),
  description TEXT,
  location_id UUID REFERENCES locations(id),   -- default location; can vary per event
  active      BOOLEAN DEFAULT true,
  created_by  UUID REFERENCES staff(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id      UUID REFERENCES event_series(id) NOT NULL,
  name           TEXT,                          -- optional; falls back to series name
  date           DATE NOT NULL,
  start_time     TEXT,
  end_time       TEXT,
  location_id    UUID REFERENCES locations(id),
  capacity       INTEGER,
  price_override NUMERIC(8,2),                  -- overrides series.price when set
  status         TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed','cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE event_registrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID REFERENCES events(id) NOT NULL,
  student_id     UUID REFERENCES students(id),  -- nullable for open events
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  amount_paid    NUMERIC(8,2),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  registered_at  TIMESTAMPTZ DEFAULT now(),
  notes          TEXT
);

ALTER TABLE event_series        ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX events_series_id  ON events (series_id);
CREATE INDEX events_date       ON events (date);
CREATE INDEX regs_event_id     ON event_registrations (event_id);
CREATE INDEX regs_student_id   ON event_registrations (student_id);
