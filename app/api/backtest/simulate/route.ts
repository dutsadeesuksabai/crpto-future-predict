/**
 * GET /api/backtest/simulate
 *
 * Runs historical prediction simulation on past kline data.
 * Does NOT use Order Book / Funding Rate / Fear&Greed (real-time only) —
 * this gives a true indicator-only accuracy baseline.
 *
 * Query params:
 *   symbol=BTCUSDT
 *   days=1          (1, 2, 3 — number of days to backtest)
 *   strategies=balanced,trend,reversal  (comma-sep, default: all 7)
 *   step=10         (minutes between predictions, default: timeframe)
 *   save=true       (save summary to Supabase backtest_runs, default false)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKlinesHistorical } from '@/lib/mexc'
import { runBacktest, type BacktestResult } from '@/lib/backtester'
import { STRATEGIES, getStrategy } from '@/lib/strategies'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Heavy computation can take a while
export const maxDuration = 60

const LOOKBACK = 200  // candles needed before first prediction
const TF_MINS: (10 | 30)[] = [10, 30]

export async function GET(req: NextRequest) {
  const symbol    = req.nextUrl.searchParams.get('symbol') ?? 'BTCUSDT'
  const days      = Math.min(3, Math.max(0.5, parseFloat(req.nextUrl.searchParams.get('days') ?? '1')))
  const stratIds  = req.nextUrl.searchParams.get('strategies')?.split(',').filter(Boolean) ?? STRATEGIES.map((s) => s.id)
  const stepParam = req.nextUrl.searchParams.get('step')
  const doSave    = req.nextUrl.searchParams.get('save') === 'true'

  try {
    // ── 1. Fetch historical klines ──────────────────────────────────────────
    // Extra lookback day so we have enough history for the first window
    const lookbackDays = Math.ceil(LOOKBACK / 1440) + 0.1
    const fromMs = Date.now() - (days + lookbackDays) * 86_400_000

    const klines1m = await getKlinesHistorical(symbol, '1m', fromMs)
    if (klines1m.length < LOOKBACK + 30) {
      return NextResponse.json({ error: `Insufficient data: ${klines1m.length} candles` }, { status: 422 })
    }

    // Build 5m klines by downsampling (group every 5 × 1m candles)
    const klines5m = downsample(klines1m, 5)

    // ── 2. Run backtest for each strategy × timeframe ───────────────────────
    const results: Record<string, Record<number, BacktestResult>> = {}
    // stratId → { 10: result, 30: result }

    const strategies = stratIds.map(getStrategy)

    for (const strat of strategies) {
      results[strat.id] = {}
      for (const tf of TF_MINS) {
        const klines = tf === 10 ? klines1m : klines5m
        const step   = stepParam ? parseInt(stepParam) : (tf === 10 ? 10 : 6)  // 5m step for 30m = 6 candles

        try {
          const r = runBacktest(klines, tf, strat, LOOKBACK, step)
          r.symbol = symbol
          // Trim ticks to reduce response size (max 500 per result)
          if (r.ticks.length > 500) {
            r.ticks = r.ticks.filter((_, i) => i % Math.ceil(r.ticks.length / 500) === 0)
          }
          results[strat.id][tf] = r
        } catch (e) {
          console.warn(`backtest failed for ${strat.id}/${tf}m: ${e}`)
        }
      }
    }

    // ── 3. Build comparison table ────────────────────────────────────────────
    const comparison = strategies.map((s) => {
      const r10 = results[s.id][10]
      const r30 = results[s.id][30]
      return {
        strategyId: s.id,
        name: s.name,
        emoji: s.emoji,
        accentColor: s.accentColor,
        '10m': r10 ? {
          accuracy: r10.summary.accuracy,
          total: r10.summary.total,
          sharpe: r10.summary.sharpe,
          totalPnl: r10.summary.totalPnlPct,
          profitFactor: r10.summary.profitFactor,
        } : null,
        '30m': r30 ? {
          accuracy: r30.summary.accuracy,
          total: r30.summary.total,
          sharpe: r30.summary.sharpe,
          totalPnl: r30.summary.totalPnlPct,
          profitFactor: r30.summary.profitFactor,
        } : null,
      }
    })

    // Sort by average accuracy across timeframes (descending)
    comparison.sort((a, b) => {
      const aAvg = ((a['10m']?.accuracy ?? 50) + (a['30m']?.accuracy ?? 50)) / 2
      const bAvg = ((b['10m']?.accuracy ?? 50) + (b['30m']?.accuracy ?? 50)) / 2
      return bAvg - aAvg
    })

    // ── 4. Optionally save to Supabase ───────────────────────────────────────
    if (doSave) {
      try {
        const db = getSupabaseAdmin()
        const rows = strategies.flatMap((s) =>
          TF_MINS.map((tf) => {
            const r = results[s.id]?.[tf]
            if (!r) return null
            return {
              symbol,
              strategy_id: s.id,
              timeframe_min: tf,
              period_days: r.periodDays,
              total: r.summary.total,
              correct: r.summary.correct,
              accuracy: r.summary.accuracy,
              avg_confidence: r.summary.avgConfidence,
              avg_quality: r.summary.avgQuality,
              total_pnl_pct: r.summary.totalPnlPct,
              sharpe: r.summary.sharpe,
              max_drawdown: r.summary.maxDrawdown,
              profit_factor: r.summary.profitFactor,
              summary: r.summary,
            }
          }).filter(Boolean)
        )
        // Fire-and-forget — don't block on DB insert
        db.from('backtest_runs').insert(rows.filter((r): r is NonNullable<typeof r> => r !== null)).then(() => {})
      } catch { /* Supabase may not have the table — silent fail */ }
    }

    return NextResponse.json({
      symbol,
      days,
      klineCount: klines1m.length,
      runAt: Date.now(),
      comparison,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** Downsample 1-minute klines to N-minute klines */
function downsample(klines: { openTime: number; open: number; high: number; low: number; close: number; volume: number; closeTime: number }[], n: number) {
  const out = []
  for (let i = 0; i + n <= klines.length; i += n) {
    const chunk = klines.slice(i, i + n)
    out.push({
      openTime:  chunk[0].openTime,
      open:      chunk[0].open,
      high:      Math.max(...chunk.map((k) => k.high)),
      low:       Math.min(...chunk.map((k) => k.low)),
      close:     chunk[chunk.length - 1].close,
      volume:    chunk.reduce((a, k) => a + k.volume, 0),
      closeTime: chunk[chunk.length - 1].closeTime,
    })
  }
  return out
}
