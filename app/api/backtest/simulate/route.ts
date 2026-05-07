/**
 * GET /api/backtest/simulate
 *
 * Runs historical prediction simulation on past kline data.
 * Uses 1-minute klines for BOTH 10m and 30m (looks 10/30 candles ahead).
 * No Order Book / Funding Rate / Fear&Greed (real-time only) — true indicator baseline.
 *
 * Query params:
 *   symbol=BTCUSDT
 *   days=1              (0.5, 1, 2, 3)
 *   strategies=balanced,trend  (comma-sep, default: all)
 *   minQuality=0        (only count ticks where signalQuality >= N, default 0 = all)
 *   step=10             (minutes between predictions, default 10)
 *   save=true           (save to Supabase backtest_runs table)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKlinesHistorical } from '@/lib/mexc'
import { runBacktest, computeSummary, type BacktestResult } from '@/lib/backtester'
import { STRATEGIES, getStrategy } from '@/lib/strategies'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** How many 1m candles to feed the indicator window */
const LOOKBACK = 200

/** Timeframes to test (in 1m-candle units = minutes) */
const TF_MINS: (10 | 30)[] = [10, 30]

export async function GET(req: NextRequest) {
  const symbol     = req.nextUrl.searchParams.get('symbol') ?? 'BTCUSDT'
  const days       = Math.min(3, Math.max(0.5, parseFloat(req.nextUrl.searchParams.get('days') ?? '1')))
  const stratIds   = req.nextUrl.searchParams.get('strategies')?.split(',').filter(Boolean) ?? STRATEGIES.map((s) => s.id)
  const minQuality = parseInt(req.nextUrl.searchParams.get('minQuality') ?? '0')
  const step       = parseInt(req.nextUrl.searchParams.get('step') ?? '10')
  const doSave     = req.nextUrl.searchParams.get('save') === 'true'

  try {
    // ── 1. Fetch historical 1m klines ────────────────────────────────────────
    // Add 1 extra day for lookback so the first prediction window is full
    const lookbackMs = (Math.ceil(LOOKBACK / 1440) + 0.2) * 86_400_000
    const fromMs     = Date.now() - days * 86_400_000 - lookbackMs

    const klines1m = await getKlinesHistorical(symbol, '1m', fromMs)

    const minRequired = LOOKBACK + Math.max(...TF_MINS) + step
    if (klines1m.length < minRequired) {
      return NextResponse.json(
        { error: `Insufficient data: ${klines1m.length} candles (need ≥ ${minRequired})` },
        { status: 422 }
      )
    }

    // ── 2. Run backtest: 1m klines for BOTH 10m and 30m ──────────────────────
    // timeframeMin is in MINUTES = number of 1m candles to look ahead
    // This fixes the 30m "—" bug from using downsampled 5m klines
    const strategies = stratIds.map(getStrategy)
    const results: Record<string, Record<number, BacktestResult>> = {}

    for (const strat of strategies) {
      results[strat.id] = {}
      for (const tf of TF_MINS) {
        try {
          const r = runBacktest(klines1m, tf, strat, LOOKBACK, step)
          r.symbol = symbol

          // If minQuality filter requested, recompute summary on filtered ticks
          if (minQuality > 0) {
            const filtered = r.ticks.filter((t) => t.signalQuality >= minQuality)
            r.summary = computeSummary(filtered, strat.id)
            r.ticks   = filtered
          }

          // Trim ticks to reduce payload (keep max 600, evenly spaced)
          if (r.ticks.length > 600) {
            const stride = Math.ceil(r.ticks.length / 600)
            r.ticks = r.ticks.filter((_, i) => i % stride === 0)
          }

          results[strat.id][tf] = r
        } catch (e) {
          console.warn(`backtest failed ${strat.id}/${tf}m:`, String(e))
        }
      }
    }

    // ── 3. Build comparison table (ranked by avg accuracy) ───────────────────
    const comparison = strategies.map((s) => {
      const r10 = results[s.id]?.[10]
      const r30 = results[s.id]?.[30]

      // Compute quality-filtered accuracy inline for the table
      const filtered10 = r10 ? getFilteredAcc(r10, 65) : null
      const filtered30 = r30 ? getFilteredAcc(r30, 65) : null

      return {
        strategyId:  s.id,
        name:        s.name,
        emoji:       s.emoji,
        accentColor: s.accentColor,
        '10m': r10 ? {
          accuracy:        r10.summary.accuracy,
          accuracyClean:   filtered10?.accuracy ?? null,
          totalClean:      filtered10?.total ?? null,
          total:           r10.summary.total,
          sharpe:          r10.summary.sharpe,
          totalPnl:        r10.summary.totalPnlPct,
          profitFactor:    r10.summary.profitFactor,
          avgQuality:      r10.summary.avgQuality,
        } : null,
        '30m': r30 ? {
          accuracy:        r30.summary.accuracy,
          accuracyClean:   filtered30?.accuracy ?? null,
          totalClean:      filtered30?.total ?? null,
          total:           r30.summary.total,
          sharpe:          r30.summary.sharpe,
          totalPnl:        r30.summary.totalPnlPct,
          profitFactor:    r30.summary.profitFactor,
          avgQuality:      r30.summary.avgQuality,
        } : null,
      }
    })

    // Rank by (10m + 30m Clean accuracy) with bonus for signal count
    comparison.sort((a, b) => {
      const aScore = score(a)
      const bScore = score(b)
      return bScore - aScore
    })

    // ── 4. Optionally persist summaries to Supabase ───────────────────────────
    if (doSave) {
      try {
        const db   = getSupabaseAdmin()
        const rows = strategies.flatMap((s) =>
          TF_MINS.map((tf) => {
            const r = results[s.id]?.[tf]
            if (!r) return null
            return {
              symbol,
              strategy_id:    s.id,
              timeframe_min:  tf,
              period_days:    r.periodDays,
              total:          r.summary.total,
              correct:        r.summary.correct,
              accuracy:       r.summary.accuracy,
              avg_confidence: r.summary.avgConfidence,
              avg_quality:    r.summary.avgQuality,
              total_pnl_pct:  r.summary.totalPnlPct,
              sharpe:         r.summary.sharpe,
              max_drawdown:   r.summary.maxDrawdown,
              profit_factor:  r.summary.profitFactor,
              summary:        r.summary,
            }
          }).filter((r): r is NonNullable<typeof r> => r !== null)
        )
        db.from('backtest_runs').insert(rows).then(() => {})
      } catch { /* silent — table may not exist yet */ }
    }

    return NextResponse.json({
      symbol,
      days,
      klineCount: klines1m.length,
      minQuality,
      runAt: Date.now(),
      comparison,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute accuracy for ticks with quality >= threshold */
function getFilteredAcc(r: BacktestResult, minQ: number) {
  const filtered = r.ticks.filter((t) => t.signalQuality >= minQ)
  if (filtered.length < 3) return null
  const correct = filtered.filter((t) => t.correct).length
  return {
    accuracy: Math.round((correct / filtered.length) * 1000) / 10,
    total: filtered.length,
  }
}

type CompRow = {
  '10m': { accuracy: number; accuracyClean: number | null; totalClean: number | null } | null
  '30m': { accuracy: number; accuracyClean: number | null; totalClean: number | null } | null
}

/** Scoring for ranking: weight clean accuracy + penalize very few signals */
function score(row: CompRow) {
  const a10 = row['10m']?.accuracyClean ?? row['10m']?.accuracy ?? 50
  const a30 = row['30m']?.accuracyClean ?? row['30m']?.accuracy ?? 50
  const n10 = row['10m']?.totalClean ?? 1
  const n30 = row['30m']?.totalClean ?? 1
  const depth10 = Math.min(1, Math.log(n10 + 1) / Math.log(20))   // log-scale signal count bonus
  const depth30 = Math.min(1, Math.log(n30 + 1) / Math.log(20))
  return (a10 * depth10 + a30 * depth30) / 2
}
