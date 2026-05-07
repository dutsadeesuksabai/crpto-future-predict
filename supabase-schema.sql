-- Run this in your Supabase SQL editor
-- https://supabase.com/dashboard/project/xwjmzpwqldaedgrbddhx/sql/new

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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON predictions(symbol);
CREATE INDEX IF NOT EXISTS idx_predictions_result ON predictions(result);
CREATE INDEX IF NOT EXISTS idx_predictions_target_time ON predictions(target_time);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon (for demo — restrict in production)
CREATE POLICY "Allow all for anon" ON predictions
  FOR ALL USING (true) WITH CHECK (true);

-- View for accuracy stats
CREATE OR REPLACE VIEW prediction_accuracy AS
SELECT
  symbol,
  timeframe,
  COUNT(*) FILTER (WHERE result != 'pending') AS total,
  COUNT(*) FILTER (WHERE result = 'correct') AS correct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE result = 'correct') /
    NULLIF(COUNT(*) FILTER (WHERE result != 'pending'), 0),
    1
  ) AS accuracy_pct
FROM predictions
GROUP BY symbol, timeframe
ORDER BY symbol, timeframe;

-- Alerts table (for Telegram deduplication)
CREATE TABLE IF NOT EXISTS alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol VARCHAR(20),
  timeframe VARCHAR(10),
  direction VARCHAR(10),
  confidence DECIMAL(5,2),
  channel VARCHAR(20) DEFAULT 'telegram',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_sent_at ON alerts(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol_tf ON alerts(symbol, timeframe, direction);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON alerts FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- Backtest simulation results (optional — run if you want persistent history)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backtest_runs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol          VARCHAR(20)  NOT NULL,
  strategy_id     VARCHAR(50)  NOT NULL,
  timeframe_min   INT          NOT NULL,   -- 10 or 30
  period_days     DECIMAL(4,2) NOT NULL,
  total           INT,
  correct         INT,
  accuracy        DECIMAL(5,2),
  avg_confidence  DECIMAL(5,2),
  avg_quality     DECIMAL(5,2),
  total_pnl_pct   DECIMAL(10,4),
  sharpe          DECIMAL(8,4),
  max_drawdown    DECIMAL(10,4),
  profit_factor   DECIMAL(8,4),
  summary         JSONB DEFAULT '{}',      -- full summary stats
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_symbol ON backtest_runs(symbol);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_runs(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_created ON backtest_runs(created_at DESC);

ALTER TABLE backtest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON backtest_runs FOR ALL USING (true) WITH CHECK (true);
