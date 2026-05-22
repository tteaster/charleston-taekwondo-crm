-- Add temperature field to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature TEXT
  CHECK (temperature IN ('hot', 'warm', 'cold'));
