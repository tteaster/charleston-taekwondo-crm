-- ============================================================
-- RETAIL — run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE retail_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL CHECK (category IN ('uniform','apparel','equipment','other')),
  price            NUMERIC(8,2) NOT NULL,
  cost             NUMERIC(8,2),                  -- what we paid (optional)
  sku              TEXT,
  track_inventory  BOOLEAN NOT NULL DEFAULT false,
  quantity_in_stock INTEGER,                      -- null when not tracking
  location_id      UUID REFERENCES locations(id), -- null = available at all locations
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE retail_sales (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retail_item_id   UUID REFERENCES retail_items(id) NOT NULL,
  student_id       UUID REFERENCES students(id),  -- nullable
  location_id      UUID REFERENCES locations(id),
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_price       NUMERIC(8,2) NOT NULL,
  total            NUMERIC(8,2) NOT NULL,
  payment_method   TEXT CHECK (payment_method IN ('cash','card','check')),
  notes            TEXT,
  sold_by          UUID REFERENCES staff(id),
  sold_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE retail_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX retail_sales_item_id    ON retail_sales (retail_item_id);
CREATE INDEX retail_sales_student_id ON retail_sales (student_id);
CREATE INDEX retail_sales_sold_at    ON retail_sales (sold_at DESC);
