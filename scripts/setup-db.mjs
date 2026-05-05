// Setup script: creates the predictions table in Supabase
// Run with: node scripts/setup-db.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(url, key, {
  auth: { persistSession: false },
  db: { schema: 'public' },
})

// Use the Postgres REST endpoint to run DDL
async function runSQL(sql) {
  const res = await fetch(`${url}/rest/v1/`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'params=single-object',
    },
  })
}

// Check if table exists
const { data, error } = await db.from('predictions').select('id').limit(1)

if (!error) {
  console.log('✅ predictions table already exists!')
  process.exit(0)
}

if (error.code !== 'PGRST205') {
  console.error('Unexpected error:', error)
  process.exit(1)
}

console.log('Table not found. Please run this SQL in your Supabase Dashboard:')
console.log('→ https://supabase.com/dashboard/project/xwjmzpwqldaedgrbddhx/sql/new\n')
console.log(`---`)

const schema = `
CREATE TABLE IF NOT EXISTS predictions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('up', 'down')),
  confidence DECIMAL(5,2),
  price_at_prediction DECIMAL(20,8) NOT NULL,
  target_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_price DECIMAL(20,8),
  result VARCHAR(20) DEFAULT 'pending' CHECK (result IN ('pending', 'correct', 'incorrect')),
  indicators JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON predictions(symbol);
CREATE INDEX IF NOT EXISTS idx_predictions_result ON predictions(result);
CREATE INDEX IF NOT EXISTS idx_predictions_target_time ON predictions(target_time);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON predictions;
CREATE POLICY "Allow all for anon" ON predictions FOR ALL USING (true) WITH CHECK (true);
`

console.log(schema)
console.log(`---`)
