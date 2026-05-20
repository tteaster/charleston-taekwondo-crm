-- ============================================================
-- COMMUNICATIONS + TAGS — run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  location_id UUID REFERENCES locations(id),  -- null = system-wide
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE student_tags (
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  tag_id     UUID REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (student_id, tag_id)
);

CREATE TABLE lead_tags (
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

CREATE TABLE communication_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type             TEXT NOT NULL CHECK (type IN ('sms', 'email')),
  subject          TEXT,
  body             TEXT NOT NULL,
  tags_used        JSONB,              -- [{id, name, color}]
  recipient_count  INTEGER DEFAULT 0,
  sent_by          UUID REFERENCES staff(id),
  sent_at          TIMESTAMPTZ DEFAULT now(),
  status           TEXT DEFAULT 'sent' CHECK (status IN ('draft','sent','failed')),
  location_id      UUID REFERENCES locations(id)
);

ALTER TABLE tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX student_tags_tag_id ON student_tags (tag_id);
CREATE INDEX lead_tags_tag_id    ON lead_tags    (tag_id);
CREATE INDEX comm_logs_sent_at   ON communication_logs (sent_at DESC);

-- ── Default tags ─────────────────────────────────────────────────────────────
INSERT INTO tags (name, color) VALUES
  ('Little Tigers', '#f59e0b'),
  ('Kids',          '#10b981'),
  ('Teen/Adult',    '#6366f1'),
  ('Afterschool',   '#0ea5e9'),
  ('Leads',         '#f97316'),
  ('All Students',  '#8b5cf6');
